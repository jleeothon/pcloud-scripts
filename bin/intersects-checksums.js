'use strict';

const {program} = require('commander');
const {promisify} = require('util');
const pcloudSdk = require('pcloud-sdk-js');
const pMap = require('p-map');
const redis = require('redis');

const pClient = pcloudSdk.createClient(process.env.ACCESS_TOKEN);
const rClient = redis.createClient();
const redisHmget = promisify(rClient.hmget).bind(rClient);

function intersects(a, b) {
	for (const v of a.values()) {
		if (b.has(v)) {
			return true;
		}
	}

	return false;
}

function mergeNames(hashesPerName) {
	const result = [];
	for (const {name, hashes} of hashesPerName) {
		const resultItem = result.find(i => intersects(hashes, i.hashUnion));
		if (!resultItem) {
			result.push({names: [name], hashUnion: hashes});
			continue;
		}

		resultItem.names.push(name);
		hashes.forEach(h => resultItem.hashUnion.add(h));
	}

	return result;
}

async function getChecksum(file) {
	const key = file.fileid.toString();
	const [checksum] = await redisHmget('checksums', key);
	if (checksum === null) {
		throw new Error(`File ${file.name}'s checksum is not cached`);
	}

	return [file.name, checksum];
}

async function run(path) {
	const response = await pClient.api('listfolder', {params: {path, recursive: 1}});
	const allFiles = response.metadata;
	const goodFolders = allFiles.contents.filter(file => file.isfolder);

	const hashesPerName = await pMap(goodFolders, async folder => {
		const name = folder.name;
		const fileList = folder.contents.filter(f => f.category === 1);
		const checksumList = await pMap(fileList, async f => getChecksum(f), {concurrency: 5});
		console.log('✓', name);
		const hashes = new Set(checksumList.map(c => c[1]));
		return {name, hashes};
	}, {concurrency: 2});

	const nonSingleMergedNames = mergeNames(hashesPerName);
	const mergedNames = nonSingleMergedNames.filter(
		({names}) => names.length > 1
	);

	const onlyNames = mergedNames.map(({names}) => names);

	console.log(onlyNames);
}

program
	.arguments('<path>')
	.action(path => {
		run(path).catch(error => {
			console.error(error);
		}).finally(() => {
			rClient.quit();
		});
	});

program.parse(process.argv);
