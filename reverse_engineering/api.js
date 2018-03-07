'use strict';

const elasticsearch = require('elasticsearch');

module.exports = {
	connect: function(connectionInfo, logger, cb){
		logger.clear();
		let connection = new elasticsearch.Client({
			host: `${connectionInfo.host}:${connectionInfo.port}`,
			log: 'trace'
		});
		cb(null, connection);
	},

	disconnect: function(connectionInfo, logger, cb){
		cb()
	},

	testConnection: function(connectionInfo, logger, cb){
		this.connect(connectionInfo, logger, (err, connection) => {
			if (err) {
				cb(err);
			} else {
				connection.ping({
					requestTimeout: 5000,
				}, (error) => {
					if (err) {
						cb(null, false);
					} else {
						cb(null, true);
					}
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

			client.indices.getMapping({
				ignoreUnavailable: true
			})
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
		let bucketList = data.collectionData.dataBaseNames;
		
		logger.log('info', getSamplingInfo(recordSamplingSettings, fieldInference), 'Reverse-Engineering sampling params', data.hiddenKeys);
		logger.log('info', { CollectionList: bucketList }, 'Selected collection list', data.hiddenKeys);

		this.connect(data, logger, (err, client) => {
			client.info().then(info => {
				let modelInfo = {
					name: info.name,
					host: data.host,
					port: +data.port,
					dbVersion: [ info.version.number ]
				};
			});

			cb(null, data);
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
