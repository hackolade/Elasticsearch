const fs = require('fs');
const path = require('path');
const fieldLevelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../properties_pane/field_level/fieldLevelConfig.json')).toString().replace(/\/\*[.\s\S]*\*\//ig, ""));

module.exports = {
	getTargetFieldLevelPropertyNames(type, data) {
		if (!fieldLevelConfig.structure[type]) {
			return [];
		}

		return fieldLevelConfig.structure[type].filter(property => {
			if (typeof property === 'object' && property.isTargetProperty) {
				if (property.dependency) {
					return (data[property.dependency.key] == property.dependency.value);
				} else {
					return true;
				}
			}

			return false;
		}).map(property => property.propertyKeyword);
	},

	getFieldProperties(type, data, pseudonyms) {
		const propertyNames = this.getTargetFieldLevelPropertyNames(type, data);

		return propertyNames.reduce((result, propertyName) => {
			if (Object.prototype.hasOwnProperty.call(data, propertyName)) {
				result[propertyName] = data[propertyName];
			} else if (Object.prototype.hasOwnProperty.call(data, pseudonyms[propertyName])) {
				result[pseudonyms[propertyName]] = data[pseudonyms[propertyName]];
			}

			return result;
		}, {});
	}
};
