const getCurlScript = (mapping, modelData, indexData) => {
	const host = modelData.host || 'localhost';
	const port = modelData.port || 9200;
	const indexName = indexData.name || '';
	const majorVersion = +(modelData.dbVersion || '').split('.').shift();
	const includeTypeName = majorVersion >= 7 ? '&include_type_name=true' : '';

	return `curl -XPUT '${host}:${port}/${indexName.toLowerCase()}?pretty${includeTypeName}' -H 'Content-Type: application/json' -d '\n${JSON.stringify(mapping, null, 4)}\n'`;
};

module.exports = {
	getCurlScript,
};
