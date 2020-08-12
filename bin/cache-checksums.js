'use strict';

/*
 * Saves checksums for all image files under process.env.FOLDER_PATH in Redis.
 */

const pcloudSdk = require('pcloud-sdk-js');

const {getFilesRecursive} = require('../lib/iter');
const RedisCacher = require('../lib/redis-cacher');

const accessToken = process.env.ACCESS_TOKEN;
const path = process.env.FOLDER_PATH;

const pClient = pcloudSdk.createClient(accessToken);
const rCacher = new RedisCacher({pCloudClient: pClient});

async function run() {
	const response = await pClient.api('listfolder', {params: {path, recursive: 1}});
	const files = getFilesRecursive(response.metadata);
	await rCacher.cacheChecksums(files);
}

run().catch(error => {
	console.error(error);
}).finally(() => {
	rCacher.quit();
});
