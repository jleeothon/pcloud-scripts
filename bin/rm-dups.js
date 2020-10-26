'use strict';

// Finds duplicates within folders, recursively

const pcloudSdk = require('pcloud-sdk-js');
const pMap = require('p-map');
const delay = require('delay');

const {getFoldersRecursive} = require('../lib/iter');

const client = pcloudSdk.createClient(process.env.ACCESS_TOKEN);

function groupByHash(files) {
	const hashToFilesMap = new Map();
	for (const file of files) {
		const fileGroup = hashToFilesMap.get(file.hash);
		if (fileGroup) {
			fileGroup.push(file);
		} else {
			hashToFilesMap.set(file.hash, [file]);
		}
	}

	// Map<hash, file[]>
	return hashToFilesMap;
}

function minDate(file) {
	const created = new Date(file.created).getTime();
	const modified = new Date(file.modified).getTime();
	return created < modified ? created : modified;
}

async function cleanFolder(folder) {
	const foldername = folder.name;
	const imageFiles = folder.contents.filter(file => file.category === 1);
	const hashToFilesMap = groupByHash(imageFiles);
	const fileGroups = [...hashToFilesMap.values()].filter(
		files => files.length > 1
	);
	fileGroups.forEach(fileGroup => fileGroup.sort((a, b) => minDate(a) - minDate(b)));

	const cleanedFileGroups = fileGroups.map(
		fileGroup => fileGroup.map(f => ({name: f.name, fileid: f.fileid}))
	);

	const result = {foldername, fileGroups: cleanedFileGroups};
	return result;
}

async function recursiveCleanFolder(folder) {
	const results = await pMap(getFoldersRecursive(folder), f => cleanFolder(f));
	return results.filter(({fileGroups}) => fileGroups.length > 0);
}

async function run() {
	const path = process.env.FOLDER_PATH;
	const response = await client.api('listfolder', {params: {path, recursive: 1}});
	const folder = response.metadata;
	const dupFilesPerFolder = await recursiveCleanFolder(folder);

	const deletion = dupFilesPerFolder.map(({foldername, fileGroups}) => {
		const keepDelGroups = fileGroups.map(g => ({
			keep: g[0],
			del: g.slice(1)
		}));
		return {foldername, keepDelGroups};
	});

	const allToDelete = deletion
		.flatMap(({keepDelGroups}) => keepDelGroups.map(({del}) => del))
		.flat();

	await pMap(
		allToDelete,
		async file => {
			const promise = delay(Math.random() * 6000);
			console.log('Deleting', file.name);
			await client.deletefile(file.fileid);
			await promise;
		},
		{concurrency: 10}
	);
}

run().catch(error => {
	console.error(error);
});
