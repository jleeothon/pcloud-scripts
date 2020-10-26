'use strict';

const {promisify} = require('util');
const delay = require('delay');
const pMap = require('p-map');
const redis = require('redis');

class RedisCacher {
	constructor({pCloudClient}) {
		this.client = redis.createClient();
		this.pCloudClient = pCloudClient;
		this.hmget = promisify(this.client.hmget).bind(this.client);
		this.hmset = promisify(this.client.hmset).bind(this.client);
	}

	/**
	 * Gets checksum from redis.
	 */
	async getChecksum(fileid) {
		const [checksum] = await this.hmget('checksums', fileid);
		return checksum;
	}

	/**
	 * Gets checksum from Redis or caches it.
	 */
	async _cacheChecksum(file) {
		const key = file.fileid.toString();
		let [checksum] = await this.hmget('checksums', key);
		if (checksum === null) {
			const delayPromise = delay(Math.random() * 6000);
			const response = await this.pCloudClient.api('checksumfile', {params: {fileid: file.fileid}});
			checksum = response.sha1;
			console.log('⬇', {file: file.name, checksum});
			await this.hmset('checksums', key, checksum);
			await delayPromise;
		}

		return checksum;
	}

	/**
	 * Caches an iterable of files into Redis if not present.
	 */
	async cacheChecksums(files) {
		await pMap(files, async file => {
			const checksum = await this._cacheChecksum(file);
			console.log('✓', {file: file.name, checksum});
		}, {concurrency: 100});
	}

	async quit() {
		return this.client.quit();
	}
}

module.exports = RedisCacher;
