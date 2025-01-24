const { getSchemaByItem } = require('./getField');

const getFieldsSchema = data => {
	const { jsonSchema, fieldLevelConfig } = data;
	let schema = {};

	if (!jsonSchema?.properties?._source?.properties) {
		return schema;
	}

	schema = getSchemaByItem(jsonSchema.properties._source.properties, data, fieldLevelConfig);

	return schema;
};

module.exports = {
	getFieldsSchema,
};
