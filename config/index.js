const Config = {
	aesKey: "IRMS!api@2189inno7016WAYS#000000",
	aseIv: "0123456789ABCDEF",
	isJwt: true,
	secret: "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDI2a2EJ7m872v0afyoSDJT2o1+SitIeJSWtLJU8/Wz2m7gStexajkeD+Lka6DSTy8gt9UwfgVQo6uKjVLG5Ex7PiGOODVqAEghBuS7JzIYU5RvI543nNDAPfnJsas96mSA7L/mD7RTE2drj6hf3oZjJpMPZUQI/B1Qjb5H3K3PNwIDAQAB",
	aesEcbKey: "agui--2009-09-25                ",
	domain: process.env.SITE_URL,
	dburl: process.env.DBCONFIG_SERVER_1,
	companyCode: "ddep",
	userName: "DDEP",
	ddepPrefix: "dapi",
	ddepAuthHeaderKey: "a4appz-api-key",
	ddepVersion: process.env.DDEP_version,
	ioRedisHost: process.env.REDIS_HOST,
	ioRedisPort: process.env.REDIS_PORT,
	ioRedisPass: process.env.REDIS_PASS,
	dataSize: process.env.DATA_SIZE,
	enableAlertDebug: process.env.EnableAlertDebug,
	scheduler_delay_minutes: 1
}

module.exports = Config;