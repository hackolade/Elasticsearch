'use strict'

const getPathById = (schema, id, path) => {
	if (schema.GUID === id) {
		return path;
	}

	if (schema.properties) {
		return Object.keys(schema.properties).reduce((newPath, propertyName) => {
			if (newPath) {
				return newPath;
			} else {
				return getPathById(schema.properties[propertyName], id, [...path, schema.properties[propertyName].GUID]);
			}
		}, undefined);
	} else if (schema.items) {
		if (Array.isArray(schema.items)) {
			return schema.items.reduce((newPath, item) => {
				if (newPath) {
					return newPath;
				} else {
					return getPathById(item, id, [...path, item.GUID]);
				}
			}, undefined);
		} else {
			return getPathById(schema.items, id, [...path, schema.items.GUID]);
		}
	}
};

const getNameByPath = (schema, path, parentName) => {
	if (schema.properties) {
		return Object.keys(schema.properties).reduce((foundedName, propertyName) => {
			if (foundedName !== "") {
				return foundedName;
			}

			const property = schema.properties[propertyName];

			if (property.GUID !== path[0]) {
				return foundedName;
			}

			if (path.length === 1) {
				return propertyName;
			}

			return getNameByPath(property, path.slice(1), propertyName);
		}, "");
	} else if (Array.isArray(schema.items)) {
		return schema.items.reduce((foundedName, property, i) => {
			if (foundedName !== "") {
				return foundedName;
			}

			if (property.GUID !== path[0]) {
				return foundedName;
			}

			if (path.length === 1) {
				return parentName + '[' + i + ']';
			}

			return getNameByPath(property, path.slice(1), parentName + '[' + i + ']');
		}, "");
	} else if (Object(schema.items) === schema.items) {
		const property = schema.items;

		if (property.GUID !== path[0]) {
			return "";
		}

		if (path.length === 1) {
			return parentName + '[0]';
		}

		return getNameByPath(property, path.slice(1), parentName + '[0]');
	}
};

const findFieldNameById = (id, source) => {
	let path = getPathById(source, id, []);
	
	if (path) {
		return getNameByPath(source, path, "");
	} else {
		return "";
	}
};

const getNamesByIds = (ids, sources) => {
	return ids.reduce((names, id) => {
		for (let i = 0; i < sources.length; i++) {
			const name = findFieldNameById(id, sources[i]);

			if (name) {
				return [...names, name];
			}
		}

		return names;
	}, []);
};

module.exports = {
	getNamesByIds
};
