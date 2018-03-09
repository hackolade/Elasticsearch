
module.exports = {
	indices: [],
	types: [],
	samples: {},

	init() {
		this.types = [];
		this.indices = [];
		this.samples = {};
	},

	addIndex(index) {
		this.indices.push(index);
	},

	addType(type) {
		this.types.push(type);
	},

	addSample(index, type, document) {
		if (!this.samples[index]) {
			this.samples[index] = {};
		}

		this.samples[index][type] = document;
	},

	getMapping(client) {
		return new Promise((resolve, reject) => {
			client.indices.getMapping({
				index: this.indices,
				type: this.types
			})
			.then(resolve)
			.catch(reject);
		});
	},

	getSchemaTemplate() {
		return {
				$schema: "http://json-schema.org/draft-04/schema#",
				type: "object",
				additionalProperties: false,
				properties: {
					_index: { type: "string", mode: "text" },
					_type: { type: "string", mode: "text" },
					_id: { type: "string", mode: "text" },
					_source: { type: "object", properties: {} }
				}
			};
	},

	getSchema(client) {
		return new Promise((resolve, reject) => {
			this.getMapping(client).then((mapping) => {
				let schemas = {};

				for (let indexName in mapping) {
					if (!schemas[indexName]) {
						schemas[indexName] = {};
					}
					const index = mapping[indexName].mappings;

					for (let typeName in index) {						
						let currentSchema = this.getSchemaTemplate();
						const type = index[typeName];
						const currentSample = this.samples[indexName][typeName];

						currentSchema.properties._source.properties = this.getFields(type.properties, currentSample._source);

						schemas[indexName][typeName] = currentSchema;
					}
				}

				resolve(schemas);
			}).catch((err) => {
				reject(err);
			});
		});
	},

	getFields(properties, sample) {
		let schema = {};

		for (let fieldName in properties) {
			const currentSample = sample && sample[fieldName];

			schema[fieldName] = this.getField(properties[fieldName], currentSample);
		}

		return schema;
	},

	getField(fieldData, sample) {
			let schema = {};
			
			if (!fieldData) {
				return schema;
			}

			schema = Object.assign(schema, this.getType(fieldData.type, sample));
			
			if (fieldData.properties) {
				schema.properties = this.getFields(fieldData.properties, sample);						
			}

			if (Array.isArray(sample)) {
				const arrayType = (schema.type === 'nested') ? schema.type : 'array';

				schema = {
					type: arrayType,
					items: schema
				};
			}

			return schema;
	},

	getType(type, value) {
		switch(type) {
			case "long":
			case "integer":
			case "short":
			case "byte":
			case "double":
			case "float":
			case "half_float":
			case "scaled_float":
				return {
					type: "number",
					mode: type	
				};
			case "keyword":
			case "text":
				return {
					type: "string",
					mode: type
				};
			case "integer_range":
			case "float_range":
			case "long_range":
			case "double_range":
			case "date_range":
				return {
					type: "range",
					mode: type
				};
			case "null":
			case "boolean":
			case "binary":
			case "geo-point":
			case "geo-shape":
			case "nested":
			case "date":
				return { type };
			default:
				if (value !== undefined) {
					const scalar = this.getScalar(value);

					if (scalar === 'string') {
						return { type: 'string', mode: 'text' };
					} else if (scalar === 'number') {
						return { 
							type: 'number',
							mode: this.getNumberMode(value)
						};
					} else {
						return {
							type: scalar
						};
					}
				} else {
					return {};
				}
		}
	},

	getScalar(value) {
		return typeof value;
	},

	getNumberMode(value) {
		const byte = 0x7F;
		const short = 0x7FFF;
		const int = 0x7FFFFFFF;
		const isFloat = (value - parseInt(value)) !== 0;

		if (isFloat) {
			return 'float';
		} else {
			if (value > -(byte + 1) && value < byte) {
				return 'byte';
			} else if (value > -(short + 1) && value < short) {
				return 'short';
			} else if (value > -(int + 1) && value < int) {
				return 'integer';
			} else {
				return 'long';
			}
		}
	}
};