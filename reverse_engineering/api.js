'use strict';

const elasticsearch = require('elasticsearch');
const fs = require('fs');
const _ = require('lodash');
const async = require('async');
const SchemaCreator = require('./SchemaCreator');
const versions = require('../package.json').contributes.target.versions;

const MAX_DOCUMENTS = 30000;

let connectionParams = {};

let _client = null;

module.exports = {
	connect: function(connectionInfo, logger, cb){
		logger.clear();
		logger.log('error', connectionInfo, 'Connection information', connectionInfo.hiddenKeys);
		
		let authString = "";

		if (_client !== null) {
			return cb(null, _client);
		}

		if (connectionInfo.username) {
			authString = connectionInfo.username;
		}

		if (connectionInfo.password) {
			authString += ':' + connectionInfo.password;
		}

		if (connectionInfo.connectionType === 'Direct connection') {
			connectionParams.host = {
				protocol: connectionInfo.protocol,
				host: connectionInfo.host,
				port: connectionInfo.port,
				path: connectionInfo.path,
				auth: authString
			};
		} else if (connectionInfo.connectionType === 'Replica set or Sharded cluster') {
			connectionParams.hosts = connectionInfo.hosts.map(socket => {
				return {
					host: socket.host,
					port: socket.port,
					protocol: connectionInfo.protocol,
					auth: authString
				};
			});
		} else {
			cb('Invalid connection parameters');
		}

		if (connectionInfo.is_ssl) {
			connectionParams.ssl = {
				ca: fs.readFileSync(connectionInfo.ca),
				rejectUnauthorized: connectionInfo.rejectUnauthorized
			};
		}

		_client = new elasticsearch.Client(connectionParams);

		cb(null, _client);
	},

	disconnect: function(connectionInfo, logger, cb){
		if (_client) {
			_client.close();
			_client = null;
		}
		connectionParams = {};
		cb()
	},

	testConnection: function(connectionInfo, logger, cb){
		this.connect(connectionInfo, logger, (err, connection) => {
			if (err) {
				cb(err);
			} else {
				connection.ping({
					requestTimeout: 5000
				}, (error, success) => {
					if (error) {
						logger.log('error', error, 'Test connection', connectionInfo.hiddenKeys);
					}
					cb(!success);
				});
			}
		});
	},

	getDatabases: function(connectionInfo, logger, cb){
		cb();
	},

	getDocumentKinds: function(connectionInfo, logger, cb) {
		cb();
	},

	getDbCollectionsNames: function(connectionInfo, logger, cb) {
		this.connect(connectionInfo, logger, (err, client) => {
			if (err) {
				logger.log('error', err);
				cb(err);
				return;
			}
			
			const { includeSystemCollection } = connectionInfo;

			client.indices.getMapping()
				.then(data => {
					let result = [];

					for (let index in data) {
						if (!includeSystemCollection && index[0] === '.') {
							continue;
						}

						let dbItem = {
							dbName: index,
							dbCollections: []
						};

						if (data[index].mappings) {
							dbItem.dbCollections = Object.keys(data[index].mappings);
						}

						result.push(dbItem);
					}

					cb(null, result);
				})
				.catch(err => {
					logger.log('error', err);
					cb(err);
				});
		});
	},

	getDbCollectionsData: function(data, logger, cb){
		let includeEmptyCollection = data.includeEmptyCollection;
		let { recordSamplingSettings, fieldInference } = data;
		const indices = data.collectionData.dataBaseNames;
		const types = data.collectionData.collections;

		const bucketInfo = {
			indexName: '_index',
			indexType: 'string',
			docTypeName: '_type',
			docTypeType: 'string',
			docIDName: '_id',
			docIDType: 'string',
			sourceName: '_source',
			sourceType: 'object'
		};

		const containetLevelKeys = {
			index: '_index',
			docType: '_type',
			docID: '_id',
			source: '_source'
		};

		logger.log('info', getSamplingInfo(recordSamplingSettings, fieldInference), 'Reverse-Engineering sampling params', data.hiddenKeys);
		logger.log('info', { Indices: indices }, 'Selected collection list', data.hiddenKeys);

		async.waterfall([
			(getDbInfo) => {
				this.connect(data, logger, getDbInfo);
			},
			(client, getMapping) => {
				client.info().then(info => {
					const socket = getInfoSocket();
					const modelInfo = {
						modelName: info.name,
						host: socket.host,
						port: +socket.port,
						version: getVersion(info.version.number, versions)
					};

					logger.log('info', { modelInfo }, 'Model info');

					getMapping(null, client, modelInfo)
				}).catch(() => getMapping(null, client));
			},

			(client, modelInfo, getData) => {
				getSchemaMapping(types, client).then((jsonSchemas) => {
					getData(null, client, modelInfo, jsonSchemas);
				}, (err) => {
					logger.log('error', err, 'Error of getting schema');
					getData(null, client, modelInfo, null);
				});
			},

			(client, modelInfo, jsonSchemas, next) => {
				async.map(indices, (indexName, nextIndex) => {
					async.map(types[indexName], (typeName, nextType) => {
						async.waterfall([
							(getSampleDocSize) => {
								client.count({
									index: indexName,
									type: typeName
								}, (err, response) => {
									getSampleDocSize(err, response);
								});
							},
							
							(response, searchData) => {
								const per = recordSamplingSettings.relative.value;
								const size = (recordSamplingSettings.active === 'absolute')
									? recordSamplingSettings.absolute.value
									: Math.round(response.count / 100 * per);
								const count = size > MAX_DOCUMENTS ? MAX_DOCUMENTS : size;

								searchData(null, count);
							},

							(size, getTypeData) => {
								client.search({
									index: indexName,
									type: typeName,
									size
								}, (err, data) => {
									getTypeData(err, data);
								});
							},

							(data, nextCallback) => {
								let documents = data.hits.hits;
								const documentTemplate = documents.reduce((tpl, doc) => _.merge(tpl, doc), {});
								
								let documentsPackage = {
									dbName: indexName,
									collectionName: typeName,
									documents,
									indexes: [],
									bucketIndexes: [],
									views: [],
									validation: false,
									emptyBucket: documents.length === 0,
									containetLevelKeys,
									bucketInfo
								};

								const hasJsonSchema = jsonSchemas && jsonSchemas[indexName] && jsonSchemas[indexName].mappings && jsonSchemas[indexName].mappings[typeName];

								if (hasJsonSchema) {
									documentsPackage.validation = {
										jsonSchema: SchemaCreator.getSchema(
											jsonSchemas[indexName].mappings[typeName],
											documentTemplate
										)
									};
								}

								if (fieldInference.active === 'field') {
									documentsPackage.documentTemplate = documentTemplate;
								}

								nextCallback(null, documentsPackage);
							}
						], nextType);
					}, (err, typeData) => {
						if (err) {
							nextIndex(err, typeData);
						} else {
							const filterData = typeData.filter(docPackage => docPackage.documents.length !== 0 || includeEmptyCollection);
							nextIndex(null, filterData);
						}
					});
				}, (err, items) => {
						next(err, items, modelInfo);
				});
			}
		], (err, items, modelInfo) => {
			if (err) {
				logger.log('error', err);
			}
			
			cb(err, items, modelInfo);
		});
	}
};

function getSamplingInfo(recordSamplingSettings, fieldInference){
	let samplingInfo = {};
	let value = recordSamplingSettings[recordSamplingSettings.active].value;
	let unit = (recordSamplingSettings.active === 'relative') ? '%' : ' records max';
	
	samplingInfo.recordSampling = `${recordSamplingSettings.active} ${value}${unit}`
	samplingInfo.fieldInference = (fieldInference.active === 'field') ? 'keep field order' : 'alphabetical order';
	
	return samplingInfo;
}

function getVersion(version, versions) {
	const arVersion = version.split('.');
	let result = "";

	versions.forEach(v => {
		const arV = v.split('.');
		let isVersion = false;

		for (let i = 0; i < arV.length; i++) {
			if (arV[0] === 'x') {
				continue;
			}

			if (arVersion[i] == arV[i]) {
				result = v;
			} else {
				break;
			}
		}
	});

	if (result) {
		return result;
	} else {
		return versions[versions.length - 1];
	}
}

function getInfoSocket() {
	if (connectionParams.host) {
		return {
			host: connectionParams.host.host,
			port: connectionParams.host.port
		};
	} else if (connectionParams.hosts) {
		return {
			host: connectionParams.hosts[0].host,
			port: connectionParams.hosts[0].port
		};
	} else {
		return {
			host: "",
			port: ""
		}
	}
}

function getSchemaMapping(indices, client) {
	SchemaCreator.init();
	for (let indexName in indices) {
		SchemaCreator.addIndex(indexName);
		for (let i in indices[indexName]) {
			SchemaCreator.addType(indices[indexName][i]);
		}
	}

	return SchemaCreator.getMapping(client);
}
