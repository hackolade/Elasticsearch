const fs = require('fs');
const path = require('path');
const fieldLevelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../properties_pane/field_level/fieldLevelConfig.json')).toString().replace(/\/\*[.\s\S]*\*\//ig, ""));

module.exports = {
	getTargetFieldLevelPropertyNames(field) {
		const type = field.type;

		if (!fieldLevelConfig.structure[type]) {
			return [];
		}

		return fieldLevelConfig.structure[type].filter(property => {
			if (typeof property === 'object' && property.isTargetProperty) {
				if (property.dependency) {
					return (field[property.dependency.key] == property.dependency.value);
				} else {
					return true;
				}
			}

			return false;
		}).map(property => property.propertyKeyword);
	},

	getFieldProperties(field) {
		const propertyNames = this.getTargetFieldLevelPropertyNames(field);

		return propertyNames.reduce((result, propertyName) => {
			if (Object.prototype.hasOwnProperty.call(field, propertyName)) {
				result[propertyName] = field[propertyName];
			}

			return result;
		}, {});
	}
};
