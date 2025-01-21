const { readConfig } = require('./readConfig');

const fieldLevelConfig = readConfig('../properties_pane/field_level/fieldLevelConfig.json');

const getTargetFieldLevelPropertyNames = (type, data) => {
	if (!fieldLevelConfig.structure[type] || !Array.isArray(fieldLevelConfig.structure[type])) {
		return [];
	}

	return fieldLevelConfig.structure[type]
		.filter(property => {
			if (typeof property === 'object' && property.isTargetProperty) {
				if (!property.dependency) {
					return true;
				} else if (data[property.dependency.key] !== property.dependency.value) {
					return false;
				} else if (Array.isArray(property.options) && !property.options.includes(data[property.propertyName])) {
					return false;
				} else {
					return true;
				}
			}

			return false;
		})
		.map(property => property.propertyKeyword);
};

const getFieldProperties = (type, data, pseudonyms) => {
	const propertyNames = getTargetFieldLevelPropertyNames(type, data);

	return propertyNames.reduce((result, propertyName) => {
		if (Object.hasOwn(data, propertyName)) {
			result[propertyName] = data[propertyName];
		} else if (Object.hasOwn(data, pseudonyms[propertyName])) {
			result[pseudonyms[propertyName]] = data[pseudonyms[propertyName]];
		}

		return result;
	}, {});
};

module.exports = {
	getFieldProperties,
};
