const { getFieldsSchema } = require('./helpers/getFieldsSchema');
const { getMappingScript } = require('./helpers/getMappingScript');
const { getTypeSchema } = require('./helpers/getTypeSchema');
const { getCurlScript } = require('./helpers/getCurlScript');
const { getKibanaScript } = require('./helpers/getKibanaScript');

module.exports = {
	generateScript(data, logger, cb) {
		const {
			jsonSchema,
			modelData,
			entityData,
			isUpdateScript,
			pluginConfiguration,
			internalDefinitions,
			modelDefinitions,
			externalDefinitions,
			containerData = {},
		} = data;

		let result = '';

		const fieldsSchema = getFieldsSchema({
			jsonSchema: JSON.parse(jsonSchema),
			internalDefinitions: JSON.parse(internalDefinitions),
			modelDefinitions: JSON.parse(modelDefinitions),
			externalDefinitions: JSON.parse(externalDefinitions),
			fieldLevelConfig: pluginConfiguration.fieldLevelConfig,
		});

		const typeSchema = getTypeSchema(entityData, fieldsSchema);

		const mappingScript = getMappingScript(containerData, typeSchema, pluginConfiguration.containerLevelConfig);

		if (isUpdateScript) {
			result = getCurlScript(mappingScript, modelData, containerData);
		} else {
			result += getKibanaScript(mappingScript, containerData);
		}

		cb(null, result);
	},
};
