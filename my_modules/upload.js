const util = require("util");
const multer = require("multer");
const maxSize = 2 * 1024 * 1024; // 2 MB

let storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, "./output/uploads/");
	},
	filename: (req, file, cb) => {
		const ext = file.mimetype.split("/")[1];
		cb(null, `import-${file.fieldname}-${Date.now()}.${ext}`);
	},
});

const multerFilter = (req, file, cb) => {
	if (file.mimetype.split("/")[1] === "json") {
		cb(null, true);
	} else {
		cb(new Error("Error: File upload only supports the following filetypes - json"), false);
	}
};

let uploadFile = multer({
	storage: storage,
	// limits: { fileSize: maxSize },
	fileFilter: multerFilter,
}).single("file");

let uploadFileMiddleware = util.promisify(uploadFile);

module.exports = uploadFileMiddleware;