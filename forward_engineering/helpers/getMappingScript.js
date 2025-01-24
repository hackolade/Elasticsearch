const { getContainerLevelProperties } = require('../../shared/getContainerLevelProperties');

const getSettings = (indexData, containerLevelConfig) => {
	let settings;
	let properties = getContainerLevelProperties(containerLevelConfig);

	properties.forEach(propertyName => {
		if (indexData[propertyName]) {
			if (!settings) {
				settings = {};
			}

			settings[propertyName] = indexData[propertyName];
		}
	});

	return settings;
};

const getAliases = indexData => {
	let aliases;

	if (!indexData.aliases) {
		return aliases;
	}

	indexData.aliases.forEach(alias => {
		if (alias.name) {
			if (!aliases) {
				aliases = {};
			}

			aliases[alias.name] = {};

			if (alias.filter) {
				let filterData = '';
				try {
					filterData = JSON.parse(alias.filter);
				} catch (e) {}

				aliases[alias.name].filter = {
					term: filterData,
				};
			}

			if (alias.routing) {
				aliases[alias.name].routing = alias.routing;
			}
		}
	});

	return aliases;
};

const getMappingScript = (indexData, typeSchema, containerLevelConfig) => {
	let mappingScript = {};
	let settings = getSettings(indexData, containerLevelConfig);
	let aliases = getAliases(indexData);

	if (settings) {
		mappingScript.settings = settings;
	}

	if (aliases) {
		mappingScript.aliases = aliases;
	}

	mappingScript.mappings = typeSchema;

	return mappingScript;
};

module.exports = {
	getMappingScript,
};
