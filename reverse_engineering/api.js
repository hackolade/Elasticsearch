'use strict';

const elasticsearch = require('elasticsearch');
const fs = require('fs');
const _ = require('lodash');
const async = require('async');
const SchemaCreator = require('./SchemaCreator');
const versions = require('../package.json').contributes.target.versions;

let connectionParams = {};

let _client = null;

module.exports = {
	connect: function (connectionInfo, logger, cb) {
		logger.clear();
		logger.log('info', connectionInfo, 'Connection information', connectionInfo.hiddenKeys);

		let authString = '';

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
				auth: authString,
			};
		} else if (connectionInfo.connectionType === 'Replica set or Sharded cluster') {
			connectionParams.hosts = connectionInfo.hosts.map(socket => {
				return {
					host: socket.host,
					port: socket.port,
					protocol: connectionInfo.protocol,
					auth: authString,
				};
			});
		} else {
			cb('Invalid connection parameters');
		}

		if (connectionInfo.is_ssl) {
			connectionParams.ssl = {
				ca: fs.readFileSync(connectionInfo.ca),
				rejectUnauthorized: connectionInfo.rejectUnauthorized,
			};
		}

		_client = new elasticsearch.Client(connectionParams);

		cb(null, _client);
	},

	disconnect: function (connectionInfo, logger, cb) {
		if (_client) {
			_client.close();
			_client = null;
		}
		connectionParams = {};
		cb();
	},

	testConnection: function (connectionInfo, logger, cb) {
		this.connect(connectionInfo, logger, (err, connection) => {
			if (err) {
				cb(err);
			} else {
				connection.ping(
					{
						requestTimeout: 5000,
					},
					(error, success) => {
						this.disconnect(connectionInfo, logger, () => {});
						if (error) {
							logger.log('error', error, 'Test connection', connectionInfo.hiddenKeys);
						}
						cb(!success);
					},
				);
			}
		});
	},

	getDatabases: function (connectionInfo, logger, cb) {
		cb();
	},

	getDocumentKinds: function (connectionInfo, logger, cb) {
		cb();
	},

	getDbCollectionsNames: function (connectionInfo, logger, cb) {
		this.connect(connectionInfo, logger, (err, client) => {
			if (err) {
				logger.log('error', err);
				cb(err);
				this.disconnect(connectionInfo, logger, () => {});
				return;
			}

			const { includeSystemCollection } = connectionInfo;

			client
				.info()
				.then(info => {
					const majorVersion = +info.version.number.split('.').shift();

					return getIndexes(client, includeSystemCollection).then(indexes => {
						return Object.keys(indexes).map(indexName => {
							let dbItem = {
								dbName: indexName,
								dbCollections: [],
							};

							if (majorVersion < 7 && indexes[indexName].mappings) {
								dbItem.dbCollections = Object.keys(indexes[indexName].mappings);
							}

							return dbItem;
						});
					});
				})
				.then(
					data => {
						cb(null, data);
					},
					err => {
						logger.log('error', err);
						cb(err);
					},
				);
		});
	},

	getDbCollectionsData: function (data, logger, cb) {
		let includeEmptyCollection = data.includeEmptyCollection;
		let { recordSamplingSettings, fieldInference } = data;
		const indices = data.collectionData.dataBaseNames;
		const types = data.collectionData.collections;

		const defaultBucketInfo = {
			indexName: '_index',
			indexType: 'string',
			docTypeName: '_type',
			docTypeType: 'string',
			docIDName: '_id',
			docIDType: 'string',
			sourceName: '_source',
			sourceType: 'object',
		};

		const containerLevelKeys = {
			index: '_index',
			docType: '_type',
			docID: '_id',
			source: '_source',
		};

		logger.log(
			'info',
			getSamplingInfo(recordSamplingSettings, fieldInference),
			'Reverse-Engineering sampling params',
			data.hiddenKeys,
		);
		logger.log('info', { Indices: indices }, 'Selected collection list', data.hiddenKeys);

		async.waterfall(
			[
				getDbInfo => {
					this.connect(data, logger, getDbInfo);
				},
				(client, getMapping) => {
					client.info().then(
						info => {
							const socket = getInfoSocket();
							const modelInfo = {
								modelName: info.name,
								host: socket.host,
								port: +socket.port,
								version: getVersion(info.version.number, versions),
							};

							logger.log('info', { modelInfo }, 'Model info');

							getMapping(null, client, modelInfo);
						},
						() => getMapping(null, client),
					);
				},

				(client, modelInfo, getData) => {
					const indexTypes = getTypesByVersion(modelInfo.version, types, indices);

					getSchemaMapping(indexTypes, client)
						.then(
							jsonSchemas => {
								getData(null, client, modelInfo, jsonSchemas);
							},
							err => {
								logger.log('error', err, 'Error of getting schema');
								getData(null, client, modelInfo, null);
							},
						)
						.catch(err => {
							logger.log('error', err);
							this.disconnect(data, logger, () => {});
							cb(err);
						});
				},

				(client, modelInfo, jsonSchemas, next) => {
					const indexTypes = getTypesByVersion(modelInfo.version, types, indices);

					async.map(
						indices,
						(indexName, nextIndex) => {
							let bucketInfo = Object.assign(
								getBucketData(jsonSchemas[indexName] || {}),
								defaultBucketInfo,
							);

							if (!indexTypes[indexName]) {
								if (includeEmptyCollection) {
									nextIndex(null, [
										{
											dbName: indexName,
											emptyBucket: true,
											containerLevelKeys,
											bucketInfo,
										},
									]);
								} else {
									nextIndex(null, [{}]);
								}
							} else {
								const majorVersion = +modelInfo.version.split('.').shift();
								const schemaData = {
									indexName,
									recordSamplingSettings,
									containerLevelKeys,
									bucketInfo,
									jsonSchemas,
									fieldInference,
									client,
								};

								if (majorVersion >= 7) {
									getIndexTypeData('', schemaData).then(
										docPackage => {
											if (shouldPackageBeAdded(docPackage, includeEmptyCollection)) {
												nextIndex(null, [docPackage]);
											} else {
												nextIndex(null, []);
											}
										},
										err => {
											nextIndex(err);
										},
									);
								} else {
									async.map(
										indexTypes[indexName],
										(typeName, nextType) => {
											getIndexTypeData(typeName, schemaData).then(
												docPackage => {
													nextType(null, docPackage);
												},
												err => {
													nextType(err);
												},
											);
										},
										(err, typeData) => {
											if (err) {
												nextIndex(err, typeData);
											} else {
												const filterData = typeData.filter(docPackage => {
													return shouldPackageBeAdded(docPackage, includeEmptyCollection);
												});
												nextIndex(null, filterData);
											}
										},
									);
								}
							}
						},
						(err, items) => {
							next(err, items, modelInfo);
						},
					);
				},
			],
			(err, items, modelInfo) => {
				if (err) {
					logger.log('error', err);
					this.disconnect(data, logger, () => {});
				}

				cb(err, items, modelInfo);
			},
		);
	},
};

const shouldPackageBeAdded = (docPackage, includeEmptyCollection) => {
	if (includeEmptyCollection) {
		return true;
	}

	if (
		docPackage.documents.length === 0 &&
		docPackage.validation &&
		docPackage.validation.jsonSchema &&
		docPackage.validation.jsonSchema.properties &&
		docPackage.validation.jsonSchema.properties._source &&
		_.isEmpty(docPackage.validation.jsonSchema.properties._source.properties)
	) {
		return false;
	}

	return true;
};

const getSampleDocSize = (count, recordSamplingSettings) => {
	if (recordSamplingSettings.active === 'absolute') {
		return Number(recordSamplingSettings.absolute.value);
	}

	const limit = Math.ceil((count * recordSamplingSettings.relative.value) / 100);

	return Math.min(limit, recordSamplingSettings.maxValue);
};

const getIndexTypeData = (
	typeName,
	{ indexName, recordSamplingSettings, containerLevelKeys, bucketInfo, jsonSchemas, fieldInference, client },
) =>
	new Promise((resolve, reject) => {
		async.waterfall(
			[
				getSampleDocSize => {
					client.count(
						{
							index: indexName,
							type: typeName,
						},
						(err, response) => {
							getSampleDocSize(err, response);
						},
					);
				},

				(response, searchData) => {
					const size = getSampleDocSize(response.count, recordSamplingSettings);

					searchData(null, size);
				},

				(size, getTypeData) => {
					client.search(
						{
							index: indexName,
							type: typeName,
							size,
						},
						(err, data) => {
							getTypeData(err, data);
						},
					);
				},

				(data, nextCallback) => {
					let documents = data.hits.hits;
					const documentTemplate = documents.reduce((tpl, doc) => _.merge(tpl, doc), {});

					let documentsPackage = {
						dbName: indexName,
						collectionName: typeName || '_doc',
						documents,
						indexes: [],
						bucketIndexes: [],
						views: [],
						validation: false,
						emptyBucket: false,
						containerLevelKeys,
						bucketInfo,
					};

					const mappingJsonSchema = typeName
						? jsonSchemas &&
							jsonSchemas[indexName] &&
							jsonSchemas[indexName].mappings &&
							jsonSchemas[indexName].mappings[typeName]
						: jsonSchemas && jsonSchemas[indexName] && jsonSchemas[indexName].mappings;
					const hasJsonSchema = Boolean(mappingJsonSchema);

					if (hasJsonSchema) {
						documentsPackage.validation = {
							jsonSchema: SchemaCreator.getSchema(mappingJsonSchema, documentTemplate),
						};
					}

					if (fieldInference.active === 'field') {
						documentsPackage.documentTemplate = documentTemplate;
					}

					nextCallback(null, documentsPackage);
				},
			],
			(err, data) => {
				if (err) {
					reject(err);
				} else {
					resolve(data);
				}
			},
		);
	});

const getTypesByVersion = (version, types, indexes) => {
	const majorVersion = +version.split('.').shift();

	if (majorVersion < 7) {
		return types;
	}

	indexes = Array.isArray(indexes) ? indexes : [];

	return indexes.reduce((result, indexName) => {
		return Object.assign({}, result, { [indexName]: [] });
	}, {});
};

const getIndexes = (client, includeSystemCollection) => {
	return client.indices.getMapping().then(data => {
		return Object.keys(data)
			.filter(indexName => {
				if (!includeSystemCollection && indexName[0] === '.') {
					return false;
				} else {
					return true;
				}
			})
			.reduce((result, indexName) => {
				return Object.assign({}, result, {
					[indexName]: data[indexName],
				});
			}, {});
	});
};

function getSamplingInfo(recordSamplingSettings, fieldInference) {
	let samplingInfo = {};
	let value = recordSamplingSettings[recordSamplingSettings.active].value;
	let unit = recordSamplingSettings.active === 'relative' ? '%' : ' records max';

	samplingInfo.recordSampling = `${recordSamplingSettings.active} ${value}${unit}`;
	samplingInfo.fieldInference = fieldInference.active === 'field' ? 'keep field order' : 'alphabetical order';

	return samplingInfo;
}

function getVersion(version, versions) {
	const arVersion = version.split('.');
	let result = '';

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
			port: connectionParams.host.port,
		};
	} else if (connectionParams.hosts) {
		return {
			host: connectionParams.hosts[0].host,
			port: connectionParams.hosts[0].port,
		};
	} else {
		return {
			host: '',
			port: '',
		};
	}
}

function getSchemaMapping(indices, client) {
	let result = {};

	SchemaCreator.init();
	for (let indexName in indices) {
		SchemaCreator.addIndex(indexName);
		for (let i in indices[indexName]) {
			SchemaCreator.addType(indices[indexName][i]);
		}
	}

	return SchemaCreator.getMapping(client)
		.then(schemas => {
			result.jsonSchemas = schemas;

			return SchemaCreator.getSettings(client);
		})
		.then(settings => {
			result.settings = settings;

			return SchemaCreator.getAliases(client);
		})
		.then(aliases => {
			result.aliases = aliases;

			return result;
		})
		.then(res => {
			let data = {};

			for (let indexName in res.jsonSchemas) {
				data[indexName] = res.jsonSchemas[indexName];
				data[indexName].settings = res.settings[indexName].settings;
				data[indexName].aliases = res.aliases[indexName].aliases;
			}

			return data;
		});
}

function getBucketData(mappingData) {
	let data = {};

	if (mappingData.settings) {
		let settingContainer = mappingData.settings;

		if (mappingData.settings.index) {
			settingContainer = mappingData.settings.index;
		}

		if (settingContainer.number_of_shards) {
			data.number_of_shards = settingContainer.number_of_shards;
		}

		if (settingContainer.number_of_replicas) {
			data.number_of_replicas = settingContainer.number_of_replicas;
		}
	}

	if (mappingData.aliases) {
		let aliases = [];

		for (let aliasName in mappingData.aliases) {
			let alias = {
				name: aliasName,
			};

			if (mappingData.aliases[aliasName].filter) {
				alias.filter = JSON.stringify(mappingData.aliases[aliasName].filter.term, null, 4);
			}

			if (mappingData.aliases[aliasName].index_routing) {
				alias.routing = mappingData.aliases[aliasName].index_routing;
			}

			aliases.push(alias);
		}

		data.aliases = aliases;
	}

	return data;
}
