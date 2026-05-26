const EnableGimaEnv = process.env.EnableGima;
const axios = require("axios");
const jwtDecode = require("jwt-decode");
const config = require("../config");
const { getUserPermissionByUsername } = require("../controllers/permissions.controller");
const { getUserDetails } = require("../controllers/user.controller");

const webRoutes = [
	"/master/environments",
	"/master/environments/create",
	"/master/environments/edit",
	"/exceptions",
	"/tools",
	"/not-authorized",
	"/404",
	"/projects/create",
	"/projects/edit",
	"/projects/project-list",
	"/logs",
	"/logs/list",
	"/notifications",
	"/permissions",
	"/permissions/create",
	"/permissions/edit",
	"/master/projects",
	"/master/projects/create",
	"/master/projects/edit",
	"/settings",
	"/email/smtp",
	"/404",
	"/500",
	"/error"
];
const canViewProjectsRoute = ["/master/projects", "/404", "/500", "/error"];
const canCreateProjectsRoute = ["/master/projects/create", "/404", "/500", "/error"];
const canModifyProjectsRoute = ["/master/projects/edit", "/404", "/500", "/error"];
const canViewItemsRoute = ["/projects/project-list", "/404", "/500", "/error"];
const canCreateItemsRoute = ["/projects/create", "/404", "/500", "/error"];
const canModifyItemsRoute = ["/projects/edit", "/404", "/500", "/error"];

const matchRoute = (originalUrl, allowedRoutes) => {
	return allowedRoutes.some(route => originalUrl.startsWith(route));
};

const removeDynamicSegment = (url) => {
	return url.replace(/\/[a-fA-F0-9]{24}$/, "");
};

const checkAuthorization = async (req, res, next) => {
	try {
		const Token = req.cookies?.Token || "";
		const permissions = req.cookies?.permissions || "{}";
		let originalUrl = req.originalUrl;
		let permission = JSON.parse(permissions);
		let userName, companyCode;

		originalUrl = removeDynamicSegment(originalUrl);

		if (!Token && EnableGimaEnv === "true") {
			return res.redirect("/not-authorized");
		}

		// Optional: Fetch user permissions and set a "permissions" cookie
		try {
			if (Token) {
				let decoded = jwtDecode(Token);
				userName = decoded.username;
				companyCode = decoded.company_code;
			}

			const userDetails = await getUserDetails(userName, companyCode);
			if (userDetails.status !== 1) {
				return res.redirect("/not-authorized");
			}

			res.locals.companyCode = companyCode;

			const userPermissions = await getUserPermissionByUsername(userName, companyCode);

			if (userPermissions?.status === 1 && userPermissions?.data) {
				const domainWithoutProtocol = "localhost"; // config.domain.replace(/(^\w+:|^)\/\//, ""); 

				permission = userPermissions.data;

				res.cookie("permissions", JSON.stringify(userPermissions.data), {
					domain: domainWithoutProtocol,
					path: "/",
					secure: true,
					sameSite: "None",
					maxAge: 10 * 60 * 60 * 1000
				});

				res.locals.userPermissions = userPermissions.data;
			} else {
				console.error("Error: Unable to set permissions cookie");
			}
		} catch (err) {
			console.error("Error fetching permissions:", err);
		}

		if (permission?.isAdmin) {
			return next();
		}

		if (
			(canViewProjectsRoute.includes(originalUrl) && permission?.canViewProjects) ||
			(canCreateProjectsRoute.includes(originalUrl) && permission?.canCreateProjects) ||
			(canModifyProjectsRoute.includes(originalUrl) && permission?.canModifyProjects) ||
			(canViewItemsRoute.includes(originalUrl) && permission?.canViewItems) ||
			(canCreateItemsRoute.includes(originalUrl) && permission?.canCreateItems) ||
			(canModifyItemsRoute.includes(originalUrl) && permission?.canModifyItems)
		) {
			return next();
		}

		return res.redirect("/not-authorized");
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const checkCompanyCode = (req, res, next) => (req.body.companyCode !== config.companyCode && EnableGimaEnv === "true") ? res.status(401).send({ status: 0, message: "You are not authorized!" }) : next();

module.exports = { checkAuthorization, checkCompanyCode };