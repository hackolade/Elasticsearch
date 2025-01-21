const { getSchemaByItem } = require('./getField');

const getFieldsSchema = data => {
	const { jsonSchema } = data;
	let schema = {};

	if (!jsonSchema?.properties?._source?.properties) {
		return schema;
	}

	schema = getSchemaByItem(jsonSchema.properties._source.properties, data);

	return schema;
};

module.exports = {
	getFieldsSchema,
};
