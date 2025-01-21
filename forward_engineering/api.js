const { getFieldsSchema } = require('./helpers/getFieldsSchema');
const { getTypeSchema } = require('./helpers/getTypeSchema');
const { getMappingScript } = require('./helpers/getMappingScript');
const { getCurlScript } = require('./helpers/getCurlScript');
const { getKibanaScript } = require('./helpers/getKibanaScript');

module.exports = {
	generateScript(data, logger, cb) {
		const { jsonSchema, modelData, entityData, isUpdateScript } = data;
		const containerData = data.containerData || {};
		let result = '';
		let fieldsSchema = getFieldsSchema({
			jsonSchema: JSON.parse(jsonSchema),
			internalDefinitions: JSON.parse(data.internalDefinitions),
			modelDefinitions: JSON.parse(data.modelDefinitions),
			externalDefinitions: JSON.parse(data.externalDefinitions),
		});
		let typeSchema = getTypeSchema(entityData, fieldsSchema);
		let mappingScript = getMappingScript(containerData, typeSchema);

		if (isUpdateScript) {
			result = getCurlScript(mappingScript, modelData, containerData);
		} else {
			result += getKibanaScript(mappingScript, containerData);
		}

		cb(null, result);
	},
};
