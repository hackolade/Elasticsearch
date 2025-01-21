const { readConfig } = require('./readConfig');

const containerLevelConfig = readConfig('../properties_pane/container_level/containerLevelConfig.json');

const getContainerLevelProperties = () => {
	let properties = [];

	containerLevelConfig.forEach(tab => {
		tab.structure.forEach(property => {
			if (property.isTargetProperty) {
				properties.push(property.propertyKeyword);
			}
		});
	});

	return properties;
};

module.exports = {
	getContainerLevelProperties,
};
