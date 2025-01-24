const getTypeSchema = (typeData, fieldsSchema) => {
	let script = {};

	if (typeData.dynamic) {
		script.dynamic = typeData.dynamic;
	}

	script.properties = fieldsSchema;

	return {
		[(typeData.collectionName || '').toLowerCase()]: script,
	};
};

module.exports = {
	getTypeSchema,
};
