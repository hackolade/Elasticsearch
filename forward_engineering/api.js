module.exports = {
	generateScript(data, logger, cb) {
		const { jsonSchema, modelData, containerData, entityData, isUpdateScript } = data;
		let result = "";
		let mappingScript = {
			mappings: {
				[entityData.collectionName.toLowerCase()]: {
					properties: this.getMappingScript(JSON.parse(jsonSchema))
				}
			}
		};

		if (isUpdateScript) {
			result = this.getCurlScript(mappingScript, modelData, containerData);
		} else {
			result += this.getKibanaScript(mappingScript, containerData);
		}

		cb(null, result);
	},

	getCurlScript(mapping, modelData, indexData) {
		const host = modelData.host || 'localhost';
		const port = modelData.port || 9200;
		const indexName = indexData.name || "";

		return `curl -XPUT '${host}:${port}/${indexName.toLowerCase()}?pretty' -H 'Content-Type: application/json' -d '\n${JSON.stringify(mapping, null, 4)}\n'`;
	},

	getKibanaScript(mapping, indexData) {
		const indexName = indexData.name || "";

		return `PUT /${indexName.toLowerCase()}\n${JSON.stringify(mapping, null, 4)}`;
	},

	getMappingScript(jsonSchema) {
		let schema = {};

		if (!(jsonSchema.properties && jsonSchema.properties._source && jsonSchema.properties._source.properties)) {
			return schema;
		}

		schema = this.getSchemaByItem(jsonSchema.properties._source.properties)

		return schema;
	},

	getSchemaByItem(properties) {
		let schema = {};

		for (let fieldName in properties) {
			let field = properties[fieldName];

			schema[fieldName] = this.getField(field);
		}

		return schema;
	},

	getField(field) {
		let schema = {};
		let type = this.getFieldType(field);

		if (type !== 'object' && type !== 'array') {
			schema.type = type;
		}

		if (type === 'object') {
			schema.properties = {};
		}

		this.setProperties(schema, field);

		if (type === 'geo_shape' || type === 'geo_point') {
			return schema;
		} else if (field.properties) {
			schema.properties = this.getSchemaByItem(field.properties);
		} else if (field.items) {
			let arrData = field.items;

			if (Array.isArray(field.items)) {
				arrData = field.items[0];
			}

			schema = Object.assign(schema, this.getField(arrData));
		}

		return schema;
	},

	getFieldType(field) {
		switch(field.type) {
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
	},

	setProperties(schema, fieldData) {
		if (schema.type === 'text') {
			schema = this.setTextProperty(schema, fieldData);
		} else if (schema.type === 'keyword') {
			schema = this.setKeywordProperty(schema, fieldData);
		} else if (
			[
				"long",
				"integer",
				"short",
				"byte",
				"double",
				"float",
				"half_float"
			].indexOf(schema.type) !== -1
		) {
			schema = this.setNumberProperties(schema, fieldData);
		} else if (schema.type === "scaled_float") {
			schema = this.setScaledFloatProperties(schema, fieldData);
		} else if (schema.type === 'boolean') {
			schema = this.setBooleanProperties(schema, fieldData);
		} else if (schema.type === 'date') {
			schema = this.setDateProperties(schema, fieldData);
		} else if (schema.type === 'binary') {
			schema = this.setBinaryProperties(schema, fieldData);
		} else if (
			[
				"integer_range",
				"float_range",
				"long_range",
				"double_range",
				"date_range"
			].indexOf(schema.type) !== -1
		) {
			schema = this.setRangeProperties(schema, fieldData);
		}

		return schema;
	},

	setTextProperty(schema, fieldData) {
		this.setProperty("boost", schema, fieldData)
			.setProperty("eager_global_ordinals", schema, fieldData)
			.setProperty("index", schema, fieldData)
			.setProperty("index_options", schema, fieldData)
			.setProperty("norms", schema, fieldData)
			.setProperty("store", schema, fieldData)
			.setProperty("similarity", schema, fieldData)
			.setProperty("include_in_all", schema, fieldData)

		if (fieldData["stringfields"] && fieldData["stringfields"].trim()) {
			schema["fields"] = JSON.parse(fieldData["stringfields"], null, 4);
		}

		return schema;
	},
	
	setKeywordProperty(schema, fieldData) {
		schema = this.setTextProperty(schema, fieldData);

		if (schema.index_options && ['freqs', 'docs'].indexOf(schema.index_options) === -1) {
			delete schema.index_options;
		}

		this.setProperty("ignore_above", schema, fieldData)
			.setProperty("doc_values", schema, fieldData)
			.setProperty("null_value", schema, fieldData);
		
		return schema;
	},

	setNumberProperties(schema, fieldData) {
		this.setProperty("coerce", schema, fieldData)
			.setProperty("boost", schema, fieldData)
			.setProperty("doc_values", schema, fieldData)
			.setProperty("ignore_malformed", schema, fieldData)
			.setProperty("index", schema, fieldData)
			.setProperty("null_value", schema, fieldData)
			.setProperty("store", schema, fieldData);

		return schema;
	},

	setScaledFloatProperties(schema, fieldData) {
		schema = this.setNumberProperties(schema, fieldData);

		this.setProperty("scaling_factor", schema, fieldData);

		return schema;
	},

	setBooleanProperties(schema, fieldData) {
		this.setProperty("boost", schema, fieldData)
			.setProperty("doc_values", schema, fieldData)
			.setProperty("index", schema, fieldData)
			.setProperty("null_value", schema, fieldData)
			.setProperty("store", schema, fieldData);

		return schema;
	},

	setDateProperties(schema, fieldData) {
		this.setProperty("boost", schema, fieldData)
			.setProperty("doc_values", schema, fieldData)
			.setProperty("format", schema, fieldData)
			.setProperty("locale", schema, fieldData)
			.setProperty("ignore_malformed", schema, fieldData)
			.setProperty("index", schema, fieldData)
			.setProperty("null_value", schema, fieldData)
			.setProperty("store", schema, fieldData);

		return schema;
	},

	setBinaryProperties(schema, fieldData) {
		this.setProperty("doc_values", schema, fieldData)
			.setProperty("store", schema, fieldData);

		return schema;
	},

	setRangeProperties(schema, fieldData) {
		this.setProperty("coerce", schema, fieldData)
			.setProperty("boost", schema, fieldData)
			.setProperty("index", schema, fieldData)
			.setProperty("store", schema, fieldData);

		return schema;
	},

	setProperty(propName, target, source) {
		if (Object.prototype.hasOwnProperty.call(source, propName)) {
			target[propName] = source[propName];
		}

		return this; 
	}
};
