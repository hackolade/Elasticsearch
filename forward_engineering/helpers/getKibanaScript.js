const getKibanaScript = (mapping, indexData) => {
	const indexName = indexData.name || '';

	return `PUT /${indexName.toLowerCase()}\n${JSON.stringify(mapping, null, 4)}`;
};

module.exports = {
	getKibanaScript,
};
