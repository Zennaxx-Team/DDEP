const { findSetting } = require("../controllers/settings.controller");

async function nonSystemCompanyPrefixUpdate(company, project, environment, item) {
    const companyPrefix = company?.isUrlPerfix ? null : company?.code || null;

    const projectPrefix = item.ProjectId == null
        ? company?.isDisableDefaultProjectPrefix
            ? null
            : company?.defaultProjectPrefix || null
        : project?.isUrlPerfix
            ? null
            : project?.code || null;

    const environmentPrefix = environment?.isUrlPerfix
        ? null
        : environment?.ddepApiPrefix?.replace(/^\/+/, '') || null;

    return { companyPrefix, projectPrefix, environmentPrefix };
}

async function systemCompanyPrefixUpdate(company, project, environment, item) {
    const responseGlobalSetting = await findSetting(company?.companyCode, 'general-settings');
    const globalSettingsData = responseGlobalSetting?.data?.data[0] || {};

    const disableDefaultProjectPrefix = globalSettingsData?.disableDefaultProjectPrefix === "off" ? 1 : 0;

    const projectPrefix = item.ProjectId == null
        ? disableDefaultProjectPrefix
            ? globalSettingsData?.defaultProjectPrefix || null
            : null
        : project?.isUrlPerfix
            ? null
            : project?.code || null;

    const environmentPrefix = environment?.isUrlPerfix
        ? null
        : environment?.ddepApiPrefix?.replace(/^\/+/, '') || null;

    return { companyPrefix: null, projectPrefix, environmentPrefix };
}

function buildUrlPrefix(companyPrefix, projectPrefix, environmentPrefix) {
	return [companyPrefix, projectPrefix, environmentPrefix].filter(Boolean).join('/');
}

module.exports = { nonSystemCompanyPrefixUpdate, systemCompanyPrefixUpdate, buildUrlPrefix };