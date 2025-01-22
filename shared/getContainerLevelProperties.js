const getContainerLevelProperties = containerLevelConfig => {
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
