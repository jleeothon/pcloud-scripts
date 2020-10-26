'use strict';

// Remove empty folders

const pcloudSdk = require('pcloud-sdk-js');
const pMap = require('p-map');
const pFilter = require('p-filter');
const delay = require('delay');
const {getFoldersRecursive} = require('../lib/iter');

const {program} = require('commander');

const client = pcloudSdk.createClient(process.env.ACCESS_TOKEN);

async function run(path) {
	const response = await client.api('listfolder', {params: {path, recursive: 1}});
	const root = getFoldersRecursive(response.metadata);
	const foldersToRemove = await pFilter(root, f => {
		return f.isfolder && f.contents.length === 0;
	});
	console.log(foldersToRemove);
	await pMap(foldersToRemove, async f => {
		const delayPromise = delay(2000);
		await client.deletefolder(f.folderid);
		await delayPromise;
	}, {concurrency: 10});
}

program
	.arguments('<path>')
	.action(path => {
		run(path).catch(error => {
			console.error(error);
		});
	});

program.parse(process.argv);
