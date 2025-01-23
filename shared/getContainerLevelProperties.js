const getContainerLevelProperties = containerLevelConfig => {
	let properties = [];

	containerLevelConfig.forEach(tab => {
		tab.structure.forEach(property => {
			if (property.isTargetProperty) {
				properties.push(property.fieldKeyword);
			}
		});
	});

	return properties;
};

module.exports = {
	getContainerLevelProperties,
};
