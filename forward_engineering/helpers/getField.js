const schemaHelper = require('../../shared/schemaHelper');
const { getFieldProperties } = require('../../shared/getFieldProperties');

const getFieldType = field => {
	switch (field.type) {
		case 'geo-shape':
			return 'geo_shape';
		case 'geo-point':
			return 'geo_point';
		case 'number':
			return field.mode || 'long';
		case 'string':
			return field.mode || 'text';
		case 'range':
			return field.mode || 'integer_range';
		case 'null':
			return 'long';
		default:
			return field.type;
	}
};

const getJoinSchema = field => {
	if (!Array.isArray(field.relations)) {
		return {};
	}

	const relations = field.relations.reduce((result, item) => {
		if (!item.parent) {
			return result;
		}

		if (!Array.isArray(item.children)) {
			return result;
		}

		if (item.children.length === 1) {
			return {
				...result,
				[item.parent]: item.children?.[0]?.name,
			};
		}

		return {
			...result,
			[item.parent]: item.children.map(item => item.name || ''),
		};
	}, {});

	return { relations };
};

const getAliasSchema = (field, data) => {
	if (!Array.isArray(field.path)) {
		return {};
	}

	if (field.path.length === 0) {
		return {};
	}

	const pathName = schemaHelper.getPathName(field.path[0].keyId, [
		data.jsonSchema,
		data.internalDefinitions,
		data.modelDefinitions,
		data.externalDefinitions,
	]);

	return { path: pathName };
};

const setProperties = (schema, properties, data) => {
	for (let propName in properties) {
		if (propName === 'stringfields') {
			try {
				schema['fields'] = JSON.parse(properties[propName]);
			} catch (e) {}
		} else if (isFieldList(properties[propName])) {
			const names = schemaHelper.getNamesByIds(
				properties[propName].map(item => item.keyId),
				[data.jsonSchema, data.internalDefinitions, data.modelDefinitions, data.externalDefinitions],
			);
			if (names.length) {
				schema[propName] = names.length === 1 ? names[0] : names;
			}
		} else {
			schema[propName] = properties[propName];
		}
	}

	return schema;
};

const isFieldList = property => {
	if (!Array.isArray(property)) {
		return false;
	}

	if (!property[0]) {
		return false;
	}

	return Boolean(property[0].keyId);
};

const getSchemaByItem = (properties, data, fieldLevelConfig) => {
	let schema = {};

	for (let fieldName in properties) {
		let field = properties[fieldName];

		schema[fieldName] = getField(field, data, fieldLevelConfig);
	}

	return schema;
};

const getField = (field, data, fieldLevelConfig) => {
	let schema = {};
	const fieldProperties = getFieldProperties(field.type, field, {}, fieldLevelConfig);
	let type = getFieldType(field);

	if (type !== 'object' && type !== 'array') {
		schema.type = type;
	}

	if (type === 'object') {
		schema.properties = {};
	}

	setProperties(schema, fieldProperties, data);

	if (type === 'alias') {
		return { ...schema, ...getAliasSchema(field, data) };
	} else if (type === 'join') {
		return { ...schema, ...getJoinSchema(field) };
	} else if (
		[
			'completion',
			'sparse_vector',
			'dense_vector',
			'geo_shape',
			'geo_point',
			'rank_feature',
			'rank_features',
		].includes(type)
	) {
		return schema;
	} else if (field.properties) {
		schema.properties = getSchemaByItem(field.properties, data, fieldLevelConfig);
	} else if (field.items) {
		let arrData = field.items;

		if (Array.isArray(field.items)) {
			arrData = field.items[0];
		}

		schema = { ...schema, ...getField(arrData, data, fieldLevelConfig) };
	}

	return schema;
};

module.exports = {
	getField,
	getSchemaByItem,
};
