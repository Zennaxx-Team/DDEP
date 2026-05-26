let itemCompanyCode = '',
	bsStepper = document.querySelectorAll('.bs-stepper'),
	select = $('.horizontal-wizard-item .select2'),
	selectClearble = $('.horizontal-wizard-item .select-clearble .select2'),
	horizontalWizard = document.querySelector('.horizontal-wizard-item'),
	apiKeyCounter = 0,
	totalRecord = [],
	currentPage = 1,
	perPage = (getCookie('selectedProject')) ? 50 : 10,
	authorizationApiKeyArray = [],
	outboundGlobalHeadersRowCounter = 1,
	outboundEndpointDataRowCounter = 0,
	boundOptionsGlobal = [],
	partiesOptionsGlobal = [],
	projectOptionGlobal = [],
	projectListOptions = [],
	companyOptionGlobal = [],
	environmentOptionGlobal = [],
	environmentListOptions = [],
	triggerRulesJson = {},
	specifyHeaderJson = {},
	validationRowCounter = 1,
	specifyHeaderCounter = 1,
	outboundGlobalVariablesBeforeTriggerCounter = 1,
	outboundGlobalVariablesAfterResponseCounter = 1,
	ddepApiPrefixUrl,
	logsItemId = '',
	globalMappingId = '',
	globalPartyId = '',
	logsPerPage = 50,
	logsCurrentPage = 1,
	logsTable = null,
	Itemtable,
	viewLogsItemId = '',
	viewLogsType = '',
	viewLogsPerPage = 50,
	viewLogsCurrentPage = 1,
	viewLogsTable,
	viewNewLogsTable,
	responseData = null,
	resLogTotalRecords = 0,
	resViewlogTotalRecords = 0,
	timePickr = $('.flatpickr-time'),
	inbound_start_date,
	inbound_end_date,
	outbound_start_date,
	outbound_end_date,
	selectedItemIds = [],
	urlPrefix = "",
	defaultProjectPrefix = "",
	reponseGloabalSetting = {},
	previousCompany = '',
	prevoiusProject = '',
	emailLogsTable = '',
	itemLogPage = false,
	mappingHistoryData = [],
	itemLogFromDate = null,
	selctedChannel = 'webhook',
	itemLogToDate = null,
	outboundActionCounter = 1,
	currentRowId = null,        // Which endpoint row is open
	currentEditActionIndex = null,
	actionCounters = {
		webhookHeaders: 1,
		webhookVariables: 1,
		emailVariables: 1,
		validationRules: 1
	},
	importStepper = null,
	importWizardState = {
		fileData: null,
		fileItems: [],
		companyType: 'existing',
		projectType: 'existing',
		itemType: 'new',
		selectedCompany: null,
		selectedProject: null,
		selectedItem: null,
		newCompanyCode: '',
		newCompanyName: '',
		newProjectCode: '',
		newProjectName: '',
		newItemCode: '',
		newItemName: '',
		// Auto-detected from JSON
		jsonCompanyId: null,
		jsonProjectId: null,
		jsonItemId: null
	},
	itemAlertPerPage = 50,
	itemAlertCurrentPage = 1,
	itemAlertTable = null;

if (timePickr.length) {
	timePickr.flatpickr({
		enableTime: true,
		noCalendar: true,
		time_24hr: true
	});
}

if (typeof ddepApiPrefix !== 'undefined') {
	ddepApiPrefixUrl = `${ddepApiPrefix}/{company-master-code}/{project-master-code}/{enviorment-master-prefix}`;
	$('#ddep-api-prefix').text(ddepApiPrefixUrl);
}

function getProjectId(url) {
	const match = url.match(/\/projects\/edit\/([^\/]+)$/);
	return match ? match[1] : null;
}

const url_item = window.location.pathname;
const pageItemId = getProjectId(url_item);

if (pageItemId) {
	logsItemId = pageItemId;
}

var start = moment().subtract(30, 'minutes');
var end = moment();

const timeOptions = {
	"30 minutes": 30,
	"60 minutes": 60,
	"3 hours": 180,
	"6 hours": 360,
	"12 hours": 720,
	"24 hours": 1440,
	"3 days": 4320,
	"7 days": 10080,
	"1 month": 43200,
	"3 months": 129600
};

const ranges = {};
for (const [label, minutes] of Object.entries(timeOptions)) {
	ranges[label] = [moment().subtract(minutes, 'minutes'), moment()];
}

$('#itemLogRange').daterangepicker({
	timePicker: true,
	timePicker24Hour: true,
	timePickerSeconds: true,
	startDate: start,
	endDate: end,
	locale: {
		format: 'MMMM D, YYYY HH:mm:ss'
	},
	ranges: ranges,
}, cb);

function cb(start, end) {
	const drp = $('#itemLogRange').data('daterangepicker');
	let matchedLabel = null;

	for (const [label, range] of Object.entries(drp.ranges)) {
		if (start.isSame(range[0], 'second') && end.isSame(range[1], 'second')) {
			matchedLabel = label;
			break;
		}
	}

	if (matchedLabel) {
		$('#itemLogRange span').html(matchedLabel);
		$('.since-time-item').text(matchedLabel);
	} else {
		const formatted = start.format('MMMM D, YYYY HH:mm:ss') + ' - ' + end.format('MMMM D, YYYY HH:mm:ss');
		$('#itemLogRange span').html(formatted);
		$('.since-time-item').text('');
	}

	itemLogFromDate = start.toISOString();
	itemLogToDate = end.toISOString();

	if (logsTable) {
		logsTable.clear().draw(); // remove all previous rows
	}

	$('#logs-data-table tbody').empty();
	logListApi(viewLogsCurrentPage, viewLogsPerPage, type = "log", logsItemId, itemLogFromDate, itemLogToDate)
}

const urlName = window.location.pathname;
if (urlName !== "/projects/project-list" && !pageItemId) {
	cb(start, end);
}

const milliseconds = (h, m, s) => ((h * 60 * 60 + m * 60 + s) * 1000);
$('#weekly_fields').hide();
$('#weekly_fields_outbound').hide();
$('#monthly_fields').hide();
$('#monthly_fields_outbound').hide();
$('#the_section').hide();
$('#the_section_outbound').hide();

if ($('#item-data-table').length) {
	toggleIconState('addIcon', true);
} else {
	toggleIconState('saveIcon', true);
}

$('body').on('click', '.addIcon', function () {
	window.location.href = '/projects/create';
});

if ($('#item-data-table').length) {
	// let perPage = (getCookie('selectedProject')) ? 50 : 10,
	currentPage = 1,
		Itemtable = $('#item-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			searching: false
		});

	getItems(parseInt(perPage), parseInt(currentPage));

	$('body').on('click', '#item-data-table_paginate .paginate_button', function () {
		currentPage = $(this).attr('data-pageno');
		Itemtable.clear();
		Itemtable.destroy();
		Itemtable = $('#item-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			searching: false
		});
		getItems(parseInt(perPage), parseInt(currentPage));
	});

	$('body').on('change', '#item-data-table_length select', function () {
		perPage = $('#item-data-table_length select').val();
		currentPage = 1;
		Itemtable.clear();
		Itemtable.destroy();
		Itemtable = $('#item-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			searching: false
		});
		getItems(parseInt(perPage), parseInt(currentPage));
	});

	function getItems(perPage, currentPage) {
		$('#item-data-table tbody').html('<tr class="odd"><td valign="top" colspan="8" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

		$.ajax({
			url: '/projects/list',
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ page: parseInt(currentPage), limit: parseInt(perPage) }),
			success: function (response) {
				const permissions = JSON.parse(decodeURIComponent(getCookie('permissions')));
				let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
				totalRecord = parseInt(response.total);

				if (response.data === undefined || response.data.length <= 0) {
					$('#item-data-table tbody').html('<tr class="odd"><td valign="top" colspan="8" class="dataTables_empty">No data available in table</td></tr>');
				}

				$.each(response.data, function (index, data) {
					let $checkbox = '<div class="custom-control custom-checkbox mt-0">' +
						'<input type="checkbox" name="item_select_' + data._id + '" id="item_select_' + data._id + '" class="custom-control-input item-checkbox" data-item-id="' + data._id + '" aria-label="Select Item">' +
						'<label class="custom-control-label" for="item_select_' + data._id + '"></label>' +
						'</div>';
					let $switchActive = '<div class="demo-inline-spacing"><div class="custom-control custom-switch custom-control-inline"><input type="checkbox" class="custom-control-input is-active-button" id="custom-switch-' + index + '" data-id="' + data._id + '"';
					$switchActive += (data.isActive == 1) ? 'checked ' : '';
					$switchActive += '/><label class="custom-control-label" for="custom-switch-' + index + '"></label></div></div>';

					let $buttonGroup = '<div class="btn-group" role="group" aria-label="Action Buttons">';
					$buttonGroup += `<button class="btn btn-outline-secondary" onclick="openItemCloneModal(this)" data-item-id="${data?._id}" data-toggle="tooltip" title="Clone"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>`;

					$buttonGroup += '<button type="button" class="btn btn-outline-secondary item-logs-modal" data-toggle="tooltip" title="Logs" data-id="' + data._id + '">Logs</button>';

					$buttonGroup += '<button type="button" class="btn btn-outline-secondary" data-toggle="tooltip" title="Run"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-refresh-cw"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg></button>';

					if (permissions?.isAdmin || permissions?.canModifyItems) {
						$buttonGroup += '<a href="/projects/edit/' + data._id + '" class="btn btn-outline-secondary" data-toggle="tooltip" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></a>';
					}
					$buttonGroup += '</div>';

					const row = Itemtable.row.add([
						$checkbox,
						counter++,
						data?.companies?.name || data?.CompanyName || data?.companyId || '',
						data.ItemCode,
						data.ItemName,
						data?.inbound_history?.status || '',
						data?.inbound_history?.createdAt ? dateFormat(data?.inbound_history?.createdAt) : '',
						$switchActive,
						$buttonGroup
					])

					Itemtable.row(row).draw(false);
				});

				$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
				let startEntry = (parseInt(currentPage) == 1) ? 1 : ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1);
				let endEntry = (parseInt(currentPage) == 1) ? parseInt(perPage) : (parseInt(perPage) * parseInt(currentPage));
				endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

				if (totalRecord == 0) {
					startEntry = 0;
				}

				const showpage = `Showing ${startEntry} to ${endEntry} of ${totalRecord} entries`;
				$('body').find('#item-data-table_info').html(showpage);

				renderPagination(parseInt(currentPage), parseInt(perPage), totalRecord);
			},
			error: function (xhr, status, error) {
				Swal.fire({
					title: 'Error!',
					text: xhr?.responseJSON?.message,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			}
		});
	}
}

function renderPagination(currentPage, perPage, totalRecord) {
	let dataDtIdx = 0;
	let paginationHtml = '';
	let firstDisable = (currentPage == 1) ? 'disabled' : '';
	let lastPage = Math.ceil(totalRecord / perPage);
	let lastDisable = (currentPage == lastPage) ? 'disabled' : '';

	if (lastPage > 0) {
		paginationHtml += `<a class="paginate_button first ${firstDisable}" data-dt-idx="${dataDtIdx++}" data-pageno="1">First</a>`;
		paginationHtml += `<a class="paginate_button previous ${firstDisable}" data-dt-idx="${dataDtIdx++}" data-pageno="${currentPage - 1}">Previous</a>`;
		paginationHtml += '<span>';

		if (currentPage > 2) {
			paginationHtml += `<a class="paginate_button" data-dt-idx="${dataDtIdx++}" data-pageno="1">1</a>`;
			if (currentPage > 3) {
				paginationHtml += '<span class="ellipsis">...</span>';
			}
		}

		if (currentPage - 1 > 0) {
			paginationHtml += `<a class="paginate_button" data-dt-idx="${dataDtIdx++}" data-pageno="${currentPage - 1}">${currentPage - 1}</a>`;
		}

		paginationHtml += `<a class="paginate_button current" data-dt-idx="${dataDtIdx++}" data-pageno="${currentPage}">${currentPage}</a>`;

		if (currentPage + 1 <= lastPage) {
			paginationHtml += `<a class="paginate_button" data-dt-idx="${dataDtIdx++}" data-pageno="${currentPage + 1}">${currentPage + 1}</a>`;
		}

		if (currentPage < lastPage - 1) {
			if (currentPage + 3 < lastPage + 1) {
				paginationHtml += '<span class="ellipsis">...</span>';
			}
			paginationHtml += `<a class="paginate_button" data-dt-idx="${dataDtIdx++}" data-pageno="${lastPage}">${lastPage}</a>`;
		}

		paginationHtml += '</span>';
		paginationHtml += `<a class="paginate_button next ${lastDisable}" data-dt-idx="${dataDtIdx++}" data-pageno="${currentPage + 1}">Next</a>`;
		paginationHtml += `<a class="paginate_button last ${lastDisable}" data-dt-idx="${dataDtIdx++}" data-pageno="${lastPage}">Last</a>`;
	}

	$('#item-data-table_paginate').html(paginationHtml);
}

async function openItemCloneModal(element) {
	const $element = $(element);
	const itemId = $element.data('item-id') || '';

	if (!itemId) return;

	$('#item-clone-id').val(itemId);

	$('.overlay, body').removeClass('loaded');
	$('.overlay').css({ 'display': 'block' });

	try {
		feather.replace();
		setupCloneFormValidation();
		await itemInitForClone();
		let response = await getItemById(itemId);
		if (response.data.length > 0) {
			let data = response.data[0];
			await itemDataBindForClone(data);
			await inboundDataBindForClone(data.inbound_setting);
			await outboundDataBindForClone(data.outbound_setting)
			await scheduleDataBindForClone(data.schedule_setting)
		}
		$('.overlay').css({ 'display': 'none' });
		$('body').addClass('loaded');
		$('#item-clone-modal-slide-in').modal('show');

	} catch (err) {
		console.error('Error opening modal:', err);
		$('.overlay').css({ 'display': 'none' });
		$('body').addClass('loaded');
	}
}

// Form validation setup for clone modal
function setupCloneFormValidation() {
	// Add custom validation methods
	$.validator.addMethod(
		'regex',
		function (value, element, regexp) {
			const re = new RegExp(regexp);
			return this.optional(element) || re.test(value);
		},
		`DDEP API is not valid (must start with a '/' and must contain any letter, capitalize letter, number, dash or underscore)`
	);

	$.validator.addMethod(
		'pattern',
		function (value, element, regexp) {
			if ((value.match(/\//g) || []).length > regexp) {
				return false;
			} else {
				return true;
			}
		},
		`DDEP API is only allow 10 '/'`
	);

	// Validate Item Form
	$('#form-item-clone-create').validate({
		onkeyup: function (element) {
			$(element).valid();
		},
		onfocusout: function (element) {
			$(element).valid();
		},
		rules: {
			'item-code': { required: true },
			'item-name': { required: true },
			'select-item-company': { required: true },
			'select-item-project': { required: true },
			'select-item-environment': { required: true }
		}
	});

	// Validate Inbound Form
	$('#form-inbound-clone-create').validate({
		onkeyup: function (element) {
			$(element).valid();
		},
		onfocusout: function (element) {
			$(element).valid();
		},
		rules: {
			'platform': { required: true },
			'platform-api-type': { required: true },
			'ddep-api-endpoint': {
				required: true,
				maxlength: 100,
				regex: /^(\/)[a-zA-Z0-9-_\/]+$/,
				pattern: 10,
			},
			'user-api': { required: true },
			'ftp-server-link': { required: true },
			'port': { required: true },
			'login-name': { required: true },
			'password': { required: true },
			'folder': { required: true }
		},
		messages: {
			'ddep-api-endpoint': {
				required: 'Please enter the DDEP API endpoint',
				maxlength: 'Maximum 100 characters allowed'
			}
		}
	});

	// Validate Outbound Form
	$('#form-outbound-clone-create').validate({
		onkeyup: function (element) {
			$(element).valid();
		},
		onfocusout: function (element) {
			$(element).valid();
		},
		rules: {
			'flow': { required: true },
			'flow-api-type': { required: true },
			'select-outbound-mime-type': { required: true }
		}
	});

	// Validate Schedule Form
	$('#form-schedule-clone-create').validate({
		onkeyup: function (element) {
			$(element).valid();
		},
		onfocusout: function (element) {
			$(element).valid();
		},
		rules: {
			'one_time_occurrence_inbound_date': {
				required: '#one_time_occurrence_inbound_date:visible'
			},
			'one_time_occurrence_inbound_time': {
				required: '#one_time_occurrence_inbound_time:visible'
			},
			'one_time_occurrence_outbound_date': {
				required: '#one_time_occurrence_outbound_date:visible'
			},
			'one_time_occurrence_outbound_time': {
				required: '#one_time_occurrence_outbound_time:visible'
			},
			'daily_frequency_once_time_inbound': {
				required: '#daily_frequency_once_time_inbound:visible'
			},
			'daily_frequency_once_time_outbound': {
				required: '#daily_frequency_once_time_outbound:visible'
			},
			'duration_inbound_start_date': {
				required: '#duration_inbound_start_date:visible'
			},
			'duration_outbound_start_date': {
				required: '#duration_outbound_start_date:visible'
			},
			'daily_frequency_every_time_count_start_inbound': {
				required: '#daily_frequency_every_time_count_start_inbound:visible'
			},
			'daily_frequency_every_time_count_start_outbound': {
				required: '#daily_frequency_every_time_count_start_outbound:visible'
			},
			'daily_frequency_every_time_count_end_inbound': {
				required: '#daily_frequency_every_time_count_end_inbound:visible'
			},
			'daily_frequency_every_time_count_end_outbound': {
				required: '#daily_frequency_every_time_count_end_outbound:visible'
			},
			'duration_inbound_end_date': {
				required: '#duration_inbound_end_date:visible'
			},
			'duration_outbound_end_date': {
				required: '#duration_outbound_end_date:visible'
			}
		}
	});
}

$(document).on('click', '.save_clone_item', function (e) {
	e.preventDefault();

	// Validate all forms
	const isItemValid = $('#form-item-clone-create').valid();
	const isInboundValid = $('#form-inbound-clone-create').valid();
	const isOutboundValid = $('#form-outbound-clone-create').valid();
	const isScheduleValid = $('#form-schedule-clone-create').valid();

	if (!isItemValid) {
		Swal.fire({
			title: 'Validation Error!',
			text: 'Please fill all required fields in Basic Information section',
			icon: 'error',
			customClass: {
				confirmButton: 'btn btn-primary'
			},
			buttonsStyling: false
		});
		return;
	}

	if (!isInboundValid) {
		Swal.fire({
			title: 'Validation Error!',
			text: 'Please fill all required fields in Inbound section',
			icon: 'error',
			customClass: {
				confirmButton: 'btn btn-primary'
			},
			buttonsStyling: false
		});
		return;
	}

	if (!isOutboundValid) {
		Swal.fire({
			title: 'Validation Error!',
			text: 'Please fill all required fields in Outbound section',
			icon: 'error',
			customClass: {
				confirmButton: 'btn btn-primary'
			},
			buttonsStyling: false
		});
		return;
	}

	if (!isScheduleValid) {
		Swal.fire({
			title: 'Validation Error!',
			text: 'Please fill all required fields in Schedule section',
			icon: 'error',
			customClass: {
				confirmButton: 'btn btn-primary'
			},
			buttonsStyling: false
		});
		return;
	}

	// If all validations pass, proceed with save
	saveCloneItemAllData();
})

function saveCloneItemAllData() {
	$('.overlay, body').removeClass('loaded');
	$('.overlay').css({ 'display': 'block' });

	try {
		// Collect all data
		const allData = {
			item: getItemData(),
			inbound: getInboundData(),
			outbound: getOutboundData(),
			schedule: getScheduleData()
		};;

		const apiUrl = '/projects/item-clone'
		const method = 'POST';

		$.ajax({
			url: apiUrl,
			method: method,
			contentType: 'application/json',
			data: JSON.stringify(allData),
			success: function (response) {
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });

				if (response.status === 1) {
					Swal.fire({
						title: 'Success!',
						text: response.message || 'Clone item created successfully!',
						icon: 'success',
						customClass: {
							confirmButton: 'btn btn-primary'
						},
						buttonsStyling: false,
						timer: 1500
					}).then(() => {
						$('#item-clone-modal-slide-in').modal('hide');
					});
				} else {
					Swal.fire({
						title: 'Error!',
						text: response.message || 'Failed to save clone item',
						icon: 'error',
						customClass: {
							confirmButton: 'btn btn-primary'
						},
						buttonsStyling: false
					});
				}
			},
			error: function (xhr, status, error) {
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });

				Swal.fire({
					title: 'Error!',
					text: xhr?.responseJSON?.message || 'An unexpected error occurred.',
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false
				});
			}
		});

	} catch (error) {
		$('.overlay, body').addClass('loaded');
		$('.overlay').css({ 'display': 'none' });

		Swal.fire({
			title: 'Error!',
			text: error.message || 'An unexpected error occurred.',
			icon: 'error',
			customClass: {
				confirmButton: 'btn btn-primary'
			},
			buttonsStyling: false
		});
	}
}

async function getItemById(id) {
	return new Promise((resolve, reject) => {
		$.ajax({
			url: '/projects/fulllistItem/' + id,
			method: 'GET',
			contentType: 'application/json',
			success: function (response) {
				resolve(response);
			},
			error: function (xhr, status, error) {
				console.error('AJAX error:', error);
				Swal.fire({
					title: 'Error!',
					text: xhr?.responseJSON?.message || 'Failed to fetch item details.',
					icon: 'error',
					customClass: { confirmButton: 'btn btn-primary' },
					buttonsStyling: false,
					timer: 1200
				});
				reject(error);
			}
		});
	});
}

async function itemDataBindForClone(data) {
	await fillItemData(data);
}

function renderNumberFunction() {
	const now = new Date();
	const year = now.getFullYear().toString().slice(-2);
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');
	return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

async function inboundDataBindForClone(data) {
	await fillInboundData(data);
	const number = renderNumberFunction(); // your function that returns a number
	const finalValue = data.api_ddep_api + "/" + number;

	$('#ddep-api-endpoint').val(finalValue);
}

async function outboundDataBindForClone(data) {
	await fillOutboundData(data);
}

async function scheduleDataBindForClone(data) {
	await fillScheduleUI(data);
}

async function itemInitForClone() {
	try {
		const response = await getAllCompanies();

		if (response.status === 1 && Array.isArray(response.data)) {
			const selectCompany = document.getElementById('select-item-company');
			selectCompany.innerHTML = '<option value="">-- Please Select --</option>';

			response.data.forEach(item => {
				const option = document.createElement('option');
				option.value = item._id;
				option.textContent = item.name;
				option.dataset.name = item.name;
				selectCompany.appendChild(option);
			});

			companyOptionGlobal = response.data;
		}
	} catch (error) {
		console.error('Error fetching companies:', error);
	}
}

// Function to collect Item Data
function getItemData() {
	let companyId = $('#select-item-company').val();
	let projectId = $('#select-item-project').val();
	let environmentId = $('#select-item-environment').val();

	// Calculate URL prefix
	const findProject = projectOptionGlobal.find((item) => item.value === projectId);
	const findEnvironment = environmentOptionGlobal.find((item) => item.value === environmentId);
	const findCompany = companyOptionGlobal.find((item) => item._id === companyId);
	let isSystemCompany = findCompany.isSystemCompany;
	let companyPrefix = null;
	let projectPrefix = null;
	let envPrefix = null;
	let urlPrefix = "";

	if (!isSystemCompany) {
		companyPrefix = findCompany?.isUrlPerfix ? null : findCompany?.code || null;
		projectPrefix = findProject?.value === ' '
			? findCompany?.isDisableDefaultProjectPrefix ? null : findCompany?.defaultProjectPrefix || null
			: findProject?.isUrlPerfix ? null : findProject?.code || null;
		envPrefix = findEnvironment?.isUrlPerfix ? null : findEnvironment?.ddepApiPrefix?.replace(/^\/+/, '') || null;
	} else {
		const globalSettingsData = reponseGloabalSetting?.data[0] || {};
		let disableDefaultProjectPrefix = globalSettingsData?.disableDefaultProjectPrefix == "off" ? 1 : 0;
		projectPrefix = findProject?.value === ' '
			? disableDefaultProjectPrefix ? globalSettingsData?.defaultProjectPrefix || null : null
			: findProject?.isUrlPerfix ? null : findProject?.code || null;
		envPrefix = findEnvironment?.isUrlPerfix ? null : findEnvironment?.ddepApiPrefix?.replace(/^\/+/, '') || null;
	}

	const parts = [companyPrefix, projectPrefix, envPrefix].filter(Boolean);
	urlPrefix = parts.join("/");
	$('#url-prefix').val(urlPrefix);

	const ddepApiPrefixUrl = urlPrefix ? `${ddepApiPrefix}/${urlPrefix}` : ddepApiPrefix;
	$('#ddep-api-prefix').text(ddepApiPrefixUrl);

	return {
		itemId: $('#item-clone-id').val() || null,
		itemCode: $('#item-code').val(),
		itemName: $('#item-name').val(),
		itemDescription: $('#item-description').val(),
		companyId: companyId,
		projectId: projectId == " " ? null : projectId,
		environmentId: environmentId,
		companyCode: itemCompanyCode,
	};
}

// Function to collect Inbound Data
function getInboundData() {
	const sync_type = $('input[name="platform"]:checked').val();
	const api_type = $('input[name="platform-api-type"]:checked').val();

	if (sync_type == 'API' && api_type == 'DDEP_API') {
		$('#inbound-shedule-setting-tab').hide();
		$('#outbound-shedule-setting-tab').hide();
		$('#inbound-ddep-api-selected').show();
		$('#outboud_max_post_file').hide();
		$('#collections_configure').show();
	}

	if (sync_type == 'API' && api_type == 'User_API') {
		$('#inbound-shedule-setting-tab').show();
		$('#outbound-shedule-setting-tab').hide();
		$('#inbound-ddep-api-selected').hide();
		$('#outboud_max_post_file').hide(); 0
		$('#collections_configure').show();
	}

	if (sync_type == 'FTP' || sync_type == 'SFTP') {
		$('#inbound-shedule-setting-tab').show();
		$('#outbound-shedule-setting-tab').show();
		$('#inbound-ddep-api-selected').hide();
		$('#outboud_max_post_file').show();
		$('#collections_configure').hide();
	}

	let apiKeyTable = [];

	$('#api-key-data-table').find('tbody tr').each(function (index) {
		let formDataObj = {};
		let $fieldset = $(this);

		formDataObj.status = $('input[name="api-key-status"]', $fieldset).is(':checked');
		formDataObj.type = $('input:text[name="type"]', $fieldset).val();
		formDataObj.key = $('input:text[name="key"]', $fieldset).val();
		formDataObj.description = $('input:text[name="description"]', $fieldset).val();
		formDataObj.expiryDate = $('input[type="date"][name="expiry-date"]', $fieldset).val() || null;

		// Check if the type is JWT_Bearer to add specific properties
		if ($('#select-ddep-api-auth-type').val() === 'JWT_Bearer') {
			formDataObj.jwtType = $('input:text[name="jwt-type"]', $fieldset).val();
			formDataObj.base64Encode = $('input:text[name="base64-encoded"]', $fieldset).val();
		}

		if (formDataObj.type && formDataObj.key) {
			apiKeyTable.push(formDataObj);
		}
	});

	let companyId = $('#select-item-company').val();
	let projectId = $('#select-item-project').val();
	let environmentId = $('#select-item-environment').val();
	urlPrefix = "";
	const findProject = projectOptionGlobal.find((item) => item.value === projectId);
	const findEnvironment = environmentOptionGlobal.find((item) => item.value === environmentId);
	const findCompany = companyOptionGlobal.find((item) => item._id === companyId);
	let isSystemCompany = findCompany.isSystemCompany;
	let companyPrefix = null;
	let projectPrefix = null;
	let envPrefix = null;

	if (!isSystemCompany) {
		companyPrefix = findCompany?.isUrlPerfix
			? null
			: findCompany?.code || null;

		projectPrefix = findProject?.value === ' '
			? findCompany?.isDisableDefaultProjectPrefix
				? null
				: findCompany?.defaultProjectPrefix || null
			: findProject?.isUrlPerfix
				? null
				: findProject?.code || null;

		envPrefix = findEnvironment?.isUrlPerfix
			? null
			: findEnvironment?.ddepApiPrefix?.replace(/^\/+/, '') || null;

	} else {
		const globalSettingsData = reponseGloabalSetting?.data[0] || {}
		let disableDefaultProjectPrefix = globalSettingsData?.disableDefaultProjectPrefix == "off" ? 1 : 0;

		projectPrefix = findProject?.value === ' '
			? disableDefaultProjectPrefix
				? globalSettingsData?.defaultProjectPrefix || null
				: null
			: findProject?.isUrlPerfix
				? null
				: findProject?.code || null;

		envPrefix = findEnvironment?.isUrlPerfix
			? null
			: findEnvironment?.ddepApiPrefix?.replace(/^\/+/, '') || null;
	}

	const parts = [companyPrefix, projectPrefix, envPrefix].filter(Boolean);
	urlPrefix = parts.join("/");
	$('#url-prefix').val(urlPrefix);

	return {
		itemId: $('#item-clone-id').val(),
		urlPrefix: urlPrefix,
		platform: $('input[name="platform"]:checked').val(),
		platformApiType: $('input[name="platform-api-type"]:checked').val(),
		mimeType: $('#select-inbound-mime-type').val(),
		ddepApiEndpoint: $('#ddep-api-endpoint').val(),
		ddepApiAuthType: $('#select-ddep-api-auth-type').val(),
		ddepApiAuthorizationApiKeys: JSON.stringify(apiKeyTable),
		userApi: $('#user-api').val(),
		ftpServerLink: $('#ftp-server-link').val(),
		port: $('#port').val(),
		loginName: $('#login-name').val(),
		password: $('#password').val(),
		folder: $('#folder').val(),
		backupFolder: $('#backup-folder').val(),
		maxFileDownload: $('#max-file-download').val(),
		enableLog: $('#inbound-step').find('#inboundEnableLogs').prop('checked') ? 'on' : 'off',
		enableEmail: $('#inbound-step').find('#inboundEnableEmail').prop('checked') ? 'on' : 'off',
		email_endpoint_url: $('#inbound-step').find("#inboundEndpointURL").prop("checked") || false,
		email_log_url: $('#inbound-step').find("#inboundLogURL").prop("checked") || false,
		email_request_header: $('#inbound-step').find("#inboundRequestHeader").prop("checked") || false,
		email_query_params: $('#inbound-step').find("#inboundQueryParams").prop("checked") || false,
		email_body: $('#inbound-step').find("#inboundBody").prop("checked") || false,
		email_body_html: $('#inbound-step').find("#inboundBodyhtml").prop("checked") || false,
		email_validation_message: $('#inbound-step').find("#inboundValidationMessage").prop("checked") || false,
		email_logs: $('#inbound-step').find("#inboundLogs").prop("checked") || false,
		is_active: $('#inbound-step').find('#is_active_inbound').prop('checked') ? 'Active' : 'InActive',
		companyCode: itemCompanyCode
	};
}

// Function to collect Outbound Data
function getOutboundData() {
	// Collect endpoint data
	let endPointTable = [];
	$('#outbound-endpoint-data-table').find('tbody tr').each(function () {
		const rowId = $(this).attr('data-id');
		let formDataObj = {};
		let $fieldset = $(this);

		let inboundValue = $('select:eq(1) option:selected', $fieldset).val();
		if (inboundValue == ' ') inboundValue = '';

		let outboundValue = $('select:eq(2) option:selected', $fieldset).val();
		if (outboundValue == ' ') outboundValue = '';

		let inboundMapping = inboundValue ? inboundValue.split('-')[0] : '';
		let inboundMappingVersion = inboundValue ? inboundValue.split('-')[1] : '';

		let outboundMapping = outboundValue ? outboundValue.split('-')[0] : '';
		let outboundMappingVersion = outboundValue ? outboundValue.split('-')[1] : '';

		formDataObj.status = $('input[name="outbound-endpoint-status"]', $fieldset).is(':checked');
		formDataObj.party = $('select:eq(0) option:selected', $fieldset).val();
		formDataObj.endpoint = $('input:text:eq(0)', $fieldset).val();
		formDataObj.inboundMappingVersion = inboundMappingVersion;
		formDataObj.outboundMappingVersion = outboundMappingVersion;
		formDataObj.inboundMapping = inboundMapping;
		formDataObj.outboundMapping = outboundMapping;
		formDataObj.default_response = $('input[name="outbound-default-response-status"]', $fieldset).is(':checked');
		formDataObj.triggerRules = triggerRulesJson[`row-${rowId}`];

		if (!specifyHeaderJson[`row-${rowId}`]) {
			specifyHeaderJson[`row-${rowId}`] = {
				headers: [],
				globalVariablesBeforeTrigger: [],
				globalVariablesAfterResponse: [],
				templateInbound: '',
				templateOutbound: '',
				logDescription: '',
				beforeLogDescription: '',
				notificationEmailTitle: '',
				notificationEmail: '',
				disableInboundEmail: false,
				disableOutboundEmail: false,
				request_method: 'DEFAULT'
			};
		}
		formDataObj.specifyHeaders = specifyHeaderJson[`row-${rowId}`];

		if (formDataObj.party && formDataObj.endpoint) {
			endPointTable.push(formDataObj);
		}
	});

	// Collect global headers
	let globalHeadersTable = [];
	$('#outbound-global-headers-table').find('tbody tr').each(function () {
		let formDataObj = {};
		let $fieldset = $(this);

		formDataObj.status = $('input[name="outbound-global-headers-status"]', $fieldset).is(':checked');
		formDataObj.key = $('input:text:eq(0)', $fieldset).val();
		formDataObj.value = $('input:text:eq(1)', $fieldset).val();
		formDataObj.mask = $('input[name="outbound-global-headers-mask"]', $fieldset).is(':checked');
		formDataObj.description = $('input:text:eq(2)', $fieldset).val();

		if (formDataObj.key && formDataObj.value) {
			globalHeadersTable.push(formDataObj);
		}
	});

	let defaultInboundMapping = $('#select-inbound-default-mapping').val();
	let defaultOutboundMapping = $('#select-outbound-default-mapping').val();

	if (defaultInboundMapping == ' ') defaultInboundMapping = null;
	if (defaultOutboundMapping == ' ') defaultOutboundMapping = null;

	let defaultInbound = defaultInboundMapping ? defaultInboundMapping.split('-')[0] : '';
	let defaultInboundMappingVersion = defaultInboundMapping ? defaultInboundMapping.split('-')[1] : '';
	let defaultOutbound = defaultOutboundMapping ? defaultOutboundMapping.split('-')[0] : '';
	let defaultOutboundMappingVersion = defaultOutboundMapping ? defaultOutboundMapping.split('-')[1] : '';

	return {
		outboundId: $('#item-outbound-id').val() || null,
		flow: $('input[name="flow"]:checked').val(),
		flowType: $('input[name="flow-api-type"]:checked').val(),
		mimeType: $('#select-outbound-mime-type').val(),
		maxFileDownload: $('#max_file_post').val(),
		defaultInboundMapping: defaultInbound,
		defaultOutboundMapping: defaultOutbound,
		defaultInboundMappingVersion: defaultInboundMappingVersion,
		defaultOutboundMappingVersion: defaultOutboundMappingVersion,
		endpoints: endPointTable,
		globalHeaders: globalHeadersTable,
		companyCode: itemCompanyCode,
		enableLog: $('#outboundEnableLogs').prop('checked') ? 'on' : 'off',
		enableEmail: $('#outboundEnableEmail').prop('checked') ? 'on' : 'off',
		email_endpoint_url: $("#outboundEndpointURL").prop("checked") || false,
		email_log_url: $("#outboundLogURL").prop("checked") || false,
		email_request_header: $("#outboundRequestHeader").prop("checked") || false,
		email_transformed_header: $("#outboundRequestTransformedHeader").prop("checked") || false,
		email_query_params: $("#outboundQueryParams").prop("checked") || false,
		email_body: $("#outboundBody").prop("checked") || false,
		email_body_html: $("#outboundBodyhtml").prop("checked") || false,
		email_transformed_body: $("#outboundTransformedBody").prop("checked") || false,
		email_transformed_body_html: $("#outboundTransformedBodyhtml").prop("checked") || false,
		email_request_endpoint_url_information: $("#outboundRequestToEndPointUrl").prop("checked") || false,
		email_response: $("#outboundResponse").prop("checked") || false,
		email_response_html: $("#outboundResponsehtml").prop("checked") || false,
		email_transformed_response: $("#outboundTransformedResponse").prop("checked") || false,
		email_transformed_response_html: $("#outboundTransformedResponsehtml").prop("checked") || false,
		email_validation_message: $("#outboundValidationMessage").prop("checked") || false,
		email_logs: $("#outboundLogs").prop("checked") || false,
		is_active: $('#is_active_outbound').prop('checked') ? 'Active' : 'InActive'
	};
}

// Function to collect Schedule Data
function getScheduleData() {
	const Schedule_configure_inbound = $('input[name="s_configure_inbound"]:checked').val();
	const schedule_type_inbound = $('input[name="schedule_type_inbound"]:checked').val();
	const day_frequency_inbound_count = $('#day_frequency_inbound_count').val();
	const weekly_frequency_inbound_count = $('#weekly_frequency_inbound_count').val();
	const monthly_frequency_day_inbound = $('#monthly_frequency_day_inbound').val();
	const monthly_frequency_day_inbound_count = $('#monthly_frequency_day_inbound_count').val();
	const monthly_frequency_the_inbound_count = $('#monthly_frequency_the_inbound_count').val();
	const daily_frequency_type_inbound = $('input[name=daily_frequency_type_inbound]:checked').val();
	const daily_frequency_once_time_inbound = $('#daily_frequency_once_time_inbound').val();
	const daily_frequency_every_time_unit_inbound = $('#daily_frequency_every_time_unit_inbound').val();
	const daily_frequency_every_time_count_inbound = $('#daily_frequency_every_time_count_inbound').val();
	const daily_frequency_every_time_count_start_inbound = $('#daily_frequency_every_time_count_start_inbound').val();
	const daily_frequency_every_time_count_end_inbound = $('#daily_frequency_every_time_count_end_inbound').val();
	const duration_inbound_end_date = $('#duration_inbound_end_date').val();
	const duration_inbound_start_date = $('#duration_inbound_start_date').val();
	const duration_inbound_is_end_date = $('input[name="duration_inbound_is_end_date"]:checked').val();
	const occurs_inbound = $('#occurs_time_inbound').val();

	const Schedule_configure_outbound = $('input[name="s_configure_outbound"]:checked').val();
	const schedule_type_outbound = $('input[name="schedule_type_outbound"]:checked').val();
	const day_frequency_outbound_count = $('#day_frequency_outbound_count').val();
	const weekly_frequency_outbound_count = $('#weekly_frequency_outbound_count').val();
	const monthly_frequency_day_outbound = $('#monthly_frequency_day_outbound').val();
	const monthly_frequency_day_outbound_count = $('#monthly_frequency_day_outbound_count').val();
	const monthly_frequency_the_outbound_count = $('#monthly_frequency_the_outbound_count').val();
	const daily_frequency_type_outbound = $('input[name=daily_frequency_type_outbound]:checked').val();
	const daily_frequency_once_time_outbound = $('#daily_frequency_once_time_outbound').val();
	const daily_frequency_every_time_unit_outbound = $('#daily_frequency_every_time_unit_outbound').val();
	const daily_frequency_every_time_count_outbound = $('#daily_frequency_every_time_count_outbound').val();
	const daily_frequency_every_time_count_end_outbound = $('#daily_frequency_every_time_count_end_outbound').val();
	const daily_frequency_every_time_count_start_outbound = $('#daily_frequency_every_time_count_start_outbound').val();
	const duration_outbound_end_date = $('#duration_outbound_end_date').val();
	const duration_outbound_start_date = $('#duration_outbound_start_date').val();
	const duration_outbound_is_end_date = $('input[name="duration_outbound_is_end_date"]:checked').val();
	const occurs_outbound = $('#occurs_time_outbound').val();
	const enableLog = $('#ScheduleEnableLogs').prop('checked') ? 'on' : 'off';

	let one_time_occurrence_inbound_date = '';
	let one_time_occurrence_inbound_time = '';
	let monthly_field_setting_inbound = [];
	let occurs_weekly_fields_inbound = [];
	let one_time_occurrence_outbound_date = '';
	let one_time_occurrence_outbound_time = '';
	let monthly_field_setting_outbound = [];
	let occurs_weekly_fields_outbound = [];

	// Inbound schedule calculations
	if (schedule_type_inbound == 'OneTime') {
		one_time_occurrence_inbound_date = $('#one_time_occurrence_inbound_date').val();
		one_time_occurrence_inbound_time = $('#one_time_occurrence_inbound_time').val();
	}

	if (occurs_inbound == 'monthly') {
		const inbound_monthly_day = $('input[name=inbound_monthly_day]:checked').val();
		if (inbound_monthly_day == 'day') {
			let temp_obj = {};
			temp_obj['inbound_monthly_day'] = 'day';
			monthly_field_setting_inbound.push(temp_obj);
		} else {
			let temp_obj = {};
			const the_day_of = $('#the_day_of').val();
			const the_days = $('#the_days').val();
			temp_obj['inbound_monthly_day'] = 'the';
			temp_obj['the_day_of'] = the_day_of;
			temp_obj['the_days'] = the_days;
			monthly_field_setting_inbound.push(temp_obj);
		}
	} else if (occurs_inbound == 'weekly') {
		$('input[name=occurs_weekly_fields_inbound]:checked').each(function () {
			const tmp_week_obj = {};
			tmp_week_obj['day'] = $(this).val();
			occurs_weekly_fields_inbound.push(tmp_week_obj);
		});
	}

	const next_date_inbound_start = new Date($("#duration_inbound_start_date").val());
	next_date_inbound_start.setSeconds(0);
	next_date_inbound_start.setMilliseconds(0);
	let next_date_inbound = parseInt(next_date_inbound_start.getTime() + (next_date_inbound_start.getTimezoneOffset() * 60 * 1000));

	if (daily_frequency_type_inbound == 'Occurs Once At') {
		const inbound_parts = daily_frequency_once_time_inbound.split(':');
		const result_inbound = milliseconds(inbound_parts[0], inbound_parts[1], 0);
		next_date_inbound = parseInt(next_date_inbound + result_inbound);
	} else {
		const inbound_parts = daily_frequency_every_time_count_start_inbound.split(':');
		const result_inbound = milliseconds(inbound_parts[0], inbound_parts[1], 0);
		next_date_inbound = parseInt(next_date_inbound + result_inbound);
	}

	// Outbound schedule calculations
	if (schedule_type_outbound == 'OneTime') {
		one_time_occurrence_outbound_date = $('#one_time_occurrence_outbound_date').val();
		one_time_occurrence_outbound_time = $('#one_time_occurrence_outbound_time').val();
	}

	if (occurs_outbound == 'monthly') {
		const outbound_monthly_day = $('input[name=outbound_monthly_day]:checked').val();
		if (outbound_monthly_day == 'day') {
			const temp_obj = {};
			temp_obj['outbound_monthly_day'] = 'day';
			monthly_field_setting_outbound.push(temp_obj);
		} else {
			const temp_obj = {};
			const the_day_of_outbound = $('#the_day_of_outbound').val();
			const the_days_outbound = $('#the_days_outbound').val();
			temp_obj['outbound_monthly_day'] = 'the';
			temp_obj['the_day_of'] = the_day_of_outbound;
			temp_obj['the_days'] = the_days_outbound;
			monthly_field_setting_outbound.push(temp_obj);
		}
	} else if (occurs_outbound == 'weekly') {
		$('input[name=occurs_weekly_fields_outbound]:checked').each(function () {
			const tmp_week_obj = {};
			tmp_week_obj['day'] = $(this).val();
			occurs_weekly_fields_outbound.push(tmp_week_obj);
		});
	}

	const next_date_outbound_start = new Date($('#duration_outbound_start_date').val());
	next_date_outbound_start.setSeconds(0);
	next_date_outbound_start.setMilliseconds(0);
	let next_date_outbound = parseInt(next_date_outbound_start.getTime() + (next_date_outbound_start.getTimezoneOffset() * 60 * 1000));

	if (daily_frequency_type_outbound == 'Occurs Once At') {
		const outbound_parts = daily_frequency_once_time_outbound.split(':');
		const result_outbound = milliseconds(outbound_parts[0], outbound_parts[1], 0);
		next_date_outbound = parseInt(next_date_outbound + result_outbound);
	} else {
		const outbound_parts = daily_frequency_every_time_count_start_outbound.split(':');
		const result_outbound = milliseconds(outbound_parts[0], outbound_parts[1], 0);
		next_date_outbound = parseInt(next_date_outbound + result_outbound);
	}

	return {
		scheduleSettingId: $('#schedule_setting_id').val() || null,
		Schedule_configure_inbound: Schedule_configure_inbound,
		schedule_type_inbound: schedule_type_inbound,
		one_time_occurrence_inbound_date: one_time_occurrence_inbound_date,
		one_time_occurrence_inbound_time: one_time_occurrence_inbound_time,
		occurs_inbound: occurs_inbound,
		monthly_field_setting_inbound: monthly_field_setting_inbound,
		occurs_weekly_fields_inbound: occurs_weekly_fields_inbound,
		day_frequency_inbound_count: day_frequency_inbound_count,
		day_frequency_outbound_count: day_frequency_outbound_count,
		weekly_frequency_inbound_count: weekly_frequency_inbound_count,
		weekly_frequency_outbound_count: weekly_frequency_outbound_count,
		monthly_frequency_day_inbound: monthly_frequency_day_inbound,
		monthly_frequency_day_inbound_count: monthly_frequency_day_inbound_count,
		monthly_frequency_day_outbound: monthly_frequency_day_outbound,
		monthly_frequency_day_outbound_count: monthly_frequency_day_outbound_count,
		monthly_frequency_the_inbound_count: monthly_frequency_the_inbound_count,
		monthly_frequency_the_outbound_count: monthly_frequency_the_outbound_count,
		daily_frequency_type_inbound: daily_frequency_type_inbound,
		daily_frequency_type_outbound: daily_frequency_type_outbound,
		daily_frequency_once_time_inbound: daily_frequency_once_time_inbound,
		daily_frequency_once_time_outbound: daily_frequency_once_time_outbound,
		daily_frequency_every_time_unit_inbound: daily_frequency_every_time_unit_inbound,
		daily_frequency_every_time_unit_outbound: daily_frequency_every_time_unit_outbound,
		daily_frequency_every_time_count_inbound: daily_frequency_every_time_count_inbound,
		daily_frequency_every_time_count_outbound: daily_frequency_every_time_count_outbound,
		daily_frequency_every_time_count_start_inbound: daily_frequency_every_time_count_start_inbound,
		daily_frequency_every_time_count_end_inbound: daily_frequency_every_time_count_end_inbound,
		daily_frequency_every_time_count_end_outbound: daily_frequency_every_time_count_end_outbound,
		daily_frequency_every_time_count_start_outbound: daily_frequency_every_time_count_start_outbound,
		Schedule_configure_outbound: Schedule_configure_outbound,
		schedule_type_outbound: schedule_type_outbound,
		one_time_occurrence_outbound_date: one_time_occurrence_outbound_date,
		one_time_occurrence_outbound_time: one_time_occurrence_outbound_time,
		occurs_outbound: occurs_outbound,
		monthly_field_setting_outbound: monthly_field_setting_outbound,
		occurs_weekly_fields_outbound: occurs_weekly_fields_outbound,
		duration_inbound_start_date: duration_inbound_start_date,
		duration_inbound_is_end_date: duration_inbound_is_end_date,
		duration_inbound_end_date: duration_inbound_end_date,
		duration_outbound_start_date: duration_outbound_start_date,
		duration_outbound_is_end_date: duration_outbound_is_end_date,
		duration_outbound_end_date: duration_outbound_end_date,
		next_date_inbound: next_date_inbound,
		next_date_outbound: next_date_outbound,
		enableLog: enableLog,
		companyCode: itemCompanyCode
	};
}

// Edit the time-filled data function here
async function fillItemData(data) {
	const selectCompany = $('#select-item-company');
	const selectProject = $('#select-item-project');
	const selectEnvironment = $('#select-item-environment');

	$('#item-code').val(data?.ItemCode);
	$('#item-name').val(data?.ItemName);
	$('#item-description').val(data?.description);

	selectCompany.data('programmaticChange', true);
	selectProject.data('programmaticChange', true);

	selectCompany.val(data.companyId).trigger('change');

	let projectId = data.ProjectId == null ? ' ' : data.ProjectId;
	let environmentId = data.environmentId;

	reponseGloabalSetting = await getGeneralSettings(data.companyCode);
	await getProjects(data.companyId, projectId);
	await getEnvironments(data.companyId, projectId, environmentId);
	await fetchMappings(data.companyId, projectId);
	await fetchParties(projectId, environmentId);

	itemCompanyCode = data.CompanyCode;

	selectCompany.data('programmaticChange', false);
	selectProject.data('programmaticChange', false);
}

async function fillInboundData(data) {
	const ddepApiAuthType = $('#select-ddep-api-auth-type');
	const mimeType = $('#select-inbound-mime-type');

	$('#item-inbound-id').val(data._id);

	setTimeout(() => {
		$(`input[value="${data.sync_type}"]`).prop('checked', true);
	}, 100);

	$('#ddep-api-endpoint').val(data.api_ddep_api);

	if (typeof data.inbound_format === 'string') {
		mimeType.val([data.inbound_format] || ['json']).trigger('change');
	} else {
		mimeType.val(data.inbound_format || ['json']).trigger('change');
	}

	ddepApiAuthType.val(data.ddep_api_auth_type).trigger('change');

	$('#user-api').val(data.api_user_api);
	$('#ftp-server-link').val(data.ftp_server_link);
	$('#port').val(data.ftp_port);
	$('#login-name').val(data.ftp_login_name);
	$('#password').val(data.ftp_password);

	$('#folder').val(data.ftp_folder);
	$('#backup-folder').val(data.ftp_backup_folder);
	$('#max-file-download').val(data.max_file_download);

	if (data.sync_type === 'API' || data.sync_type == '' || data.sync_type == undefined) {

		$('.platform-api-options').show();
		$('.platform-ftp-options').hide();
		$(`input[value="${data.api_type}"]`).prop('checked', true);

		if (data.api_type && data.api_type === 'User_API') {
			$('.ddep-api-type').hide();
			$('.user-api-type').show();
			$('#inbound-ddep-api-selected').hide();
			$('#outboud_max_post_file').hide();
			$('#inbound-shedule-setting-tab').show();
			$('#outbound-shedule-setting-tab').hide();
		} else {
			$('.ddep-api-type').show();
			$('.user-api-type').hide();
			$('#inbound-ddep-api-selected').show();
			$('#inbound-shedule-setting-tab').hide();
			$('#outboud_max_post_file').hide();
			$('#outbound-shedule-setting-tab').hide();
		}

	} else if (data.sync_type && (data.sync_type === 'FTP' || data.sync_type === 'SFTP')) {

		$('.platform-api-options').hide();
		$('.ddep-api-type').show();
		$('#inbound-ddep-api-selected').hide();
		$('.user-api-type').hide();
		$('.platform-ftp-options').show();
		$('#outboud_max_post_file').show();
		$('#inbound-ddep-api-selected').hide();
	}

	if (data.enableLog === undefined || data.enableLog === 'off') {
		$('#inbound-step').find('#inboundEnableLogs').prop('checked', false);
	} else {
		$('#inbound-step').find('#inboundEnableLogs').prop('checked', true);
	}

	if (data.enableEmail === undefined || data.enableEmail === 'off') {
		$('#inbound-step').find('#inboundEnableEmail').prop('checked', false);
	} else {
		$('#inbound-step').find('#inboundEnableEmail').prop('checked', true);
	}

	if (data.disabledInboundEmailFailuresNotice === undefined || data.disabledInboundEmailFailuresNotice === 'off') {
		$('#inbound-step').find('#disabledInboundEmailFailuresNotice').prop('checked', false);
	} else {
		$('#inbound-step').find('#disabledInboundEmailFailuresNotice').prop('checked', true);
	}

	$('#inbound-step').find('#inboundEndpointURL').prop('checked', data.email_endpoint_url == undefined ? false : data.email_endpoint_url);
	$('#inbound-step').find('#inboundLogURL').prop('checked', data.email_log_url == undefined ? false : data.email_log_url);
	$('#inbound-step').find('#inboundRequestHeader').prop('checked', data.email_request_header == undefined ? false : data.email_request_header);
	$('#inbound-step').find('#inboundQueryParams').prop('checked', data.email_query_params == undefined ? false : data.email_query_params);
	$('#inbound-step').find('#inboundBody').prop('checked', data.email_body == undefined ? false : data.email_body);
	$('#inbound-step').find('#inboundBodyhtml').prop('checked', data.email_body_html == undefined ? false : data.email_body_html);
	$('#inbound-step').find('#inboundValidationMessage').prop('checked', data.email_validation_message == undefined ? false : data.email_validation_message);
	$('#inbound-step').find('#inboundLogs').prop('checked', data.email_logs == undefined ? false : data.email_logs);

	if (data.is_active === undefined || data.is_active === 'InActive') {
		$('#inbound-step').find('#is_active_inbound').prop('checked', false);
	} else {
		$('#inbound-step').find('#is_active_inbound').prop('checked', true);
	}

	const apiKeys = data.ddep_api_authorization_api_keys || [];
	apiKeys.forEach((apiKey) => {
		generateApiKeyRow(apiKey.type, apiKey.key, apiKey.description, apiKey.jwtType, apiKey.base64Encode, apiKey.expiryDate);
	});
}

async function fillOutboundData(data) {
	const mimeType = $('#select-outbound-mime-type');
	const defaultInboundMapping = $('#select-inbound-default-mapping');
	const defaultOutboundMapping = $('#select-outbound-default-mapping');

	$('#item-outbound-id').val(data._id);

	$(`input[value="${data.sync_type_out}"]`).prop('checked', true);
	$(`input[value="${data.flowType}"]`).prop('checked', true);

	var max_file_posts = (data.max_file_post == undefined) ? 50 : data.max_file_post;
	$('#max_file_post').val(max_file_posts);

	if (typeof data.outbound_format === 'string') {
		mimeType.val([data.outbound_format] || ['json']).trigger('change');
	} else {
		mimeType.val(data.outbound_format || ['json']).trigger('change');
	}

	let defaultInboundMappingResult1 = data.defaultInboundMapping;
	let defaultOutboundMappingResult1 = data.defaultOutboundMapping;

	if (defaultInboundMappingResult1 == null) {
		defaultInboundMappingResult1 = ' ';
	}

	if (defaultOutboundMappingResult1 == null) {
		defaultOutboundMappingResult1 = ' ';
	}

	let defaultInbound = defaultInboundMappingResult1 !== ' ' ? defaultInboundMappingResult1.concat('-', data.defaultInboundMappingVersion) : ' ';
	let defaultOutbound = defaultOutboundMappingResult1 !== ' ' ? defaultOutboundMappingResult1.concat('-', data.defaultOutboundMappingVersion) : ' ';

	defaultInboundMapping.val(defaultInbound).trigger('change');
	defaultOutboundMapping.val(defaultOutbound).trigger('change');

	if (data.flowType === 'multiple') {
		$('.multiple-api-type').show();
		sortbleTable('multiple');
	} else {
		$('.multiple-api-type').hide();
		sortbleTable('single');
	}

	const globalHeaders = data?.globalHeaders;
	if (globalHeaders && globalHeaders.length > 0) {
		let globalHeadersHtml = '';

		for (let i = 0; i < globalHeaders.length; i++) {
			const status = (globalHeaders[i]?.status === true) ? 'checked' : '';
			const key = globalHeaders[i]?.key || '';
			const value = globalHeaders[i]?.value || '';
			const mask = (globalHeaders[i]?.mask === true) ? 'checked' : '';
			const description = globalHeaders[i]?.description || '';

			if (key && value) {
				let newRow = '<tr>';
				let newCols = '';

				newCols += `<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound-global-headers-status" id="outbound-global-headers-status-${i}" class="custom-control-input" ${status} /><label class="custom-control-label" for="outbound-global-headers-status-${i}"></label></div></td>`;
				newCols += `<td class="col-sm-3"><input type="text" name="outbound-global-headers[][key]" class="form-control border-0" id="outbound-global-headers-key-${i}" value="${key}" /></td>`;
				newCols += `<td class="col-sm-4"><input type="text" name="outbound-global-headers[][value]" class="form-control border-0" id="outbound-global-headers-value-${i}" value="${value.replace(/"/g, '&quot;')}" /></td>`;
				newCols += `<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound-global-headers-mask" id="outbound-global-headers-mask-${i}" class="custom-control-input" ${mask} /><label class="custom-control-label" for="outbound-global-headers-mask-${i}"></label></div></td>`;
				newCols += `<td class="col-sm-3"><input type="text" name="outbound-global-headers[][description]" class="form-control border-0" id="outbound-global-headers-description-${i}" value="${description}" /></td>`;
				newCols += '<td class="col-sm-1 text-center"><a href="javascript:void(0);" type="button" class="outbound-global-headers-btn-del btn btn-lg btn-del modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';

				newRow += newCols;
				newRow += '</tr>';

				globalHeadersHtml += newRow;
				outboundGlobalHeadersRowCounter = i + 1;
			}
		}

		if (globalHeadersHtml) {
			$('#outbound-global-headers-table tbody').html(globalHeadersHtml);
		}
	}

	const endpoints = data.endpoints;
	if (endpoints && endpoints.length > 0) {
		outboundEndpointDataRowCounter = 0;
		outboundEndPointMapping(endpoints, false)
	} else {
		$('#outbound-endpoint-data-table tbody').empty();
		outboundEndpointDataRowCounter = 0;
		addRowToOutboundEndpointTable();
	}

	if (data.enableLog === undefined || data.enableLog === 'off') {
		$('#outbound-step').find('#outboundEnableLogs').prop('checked', false);
	} else {
		$('#outbound-step').find('#outboundEnableLogs').prop('checked', true);
	}

	if (data.disabledOutboundResponseFailuresNotice === undefined || data.disabledOutboundResponseFailuresNotice === 'off') {
		$('#outbound-step').find('#disabledOutboundResponseFailuresNotice').prop('checked', false);
	} else {
		$('#outbound-step').find('#disabledOutboundResponseFailuresNotice').prop('checked', true);
	}

	if (data.disabledOutboundEmailFailuresNotice === undefined || data.disabledOutboundEmailFailuresNotice === 'off') {
		$('#outbound-step').find('#disabledOutboundEmailFailuresNotice').prop('checked', false);
	} else {
		$('#outbound-step').find('#disabledOutboundEmailFailuresNotice').prop('checked', true);
	}

	if (data.enableEmail === undefined || data.enableEmail === 'off') {
		$('#outbound-step').find('#outboundEnableEmail').prop('checked', false);
	} else {
		$('#outbound-step').find('#outboundEnableEmail').prop('checked', true);
	}
	$('#outbound-step').find('#outboundEndpointURL').prop('checked', data.email_endpoint_url == undefined ? false : data.email_endpoint_url);
	$('#outbound-step').find('#outboundLogURL').prop('checked', data.email_log_url == undefined ? false : data.email_log_url);
	$('#outbound-step').find('#outboundRequestHeader').prop('checked', data.email_request_header == undefined ? false : data.email_request_header);
	$('#outbound-step').find('#outboundRequestTransformedHeader').prop('checked', data.email_transformed_header == undefined ? false : data.email_transformed_header);
	$('#outbound-step').find('#outboundQueryParams').prop('checked', data.email_query_params == undefined ? false : data.email_query_params);
	$('#outbound-step').find('#outboundBody').prop('checked', data.email_body == undefined ? false : data.email_body);
	$('#outbound-step').find('#outboundBodyhtml').prop('checked', data.email_body_html == undefined ? false : data.email_body_html);
	$('#outbound-step').find('#outboundTransformedBody').prop('checked', data.email_transformed_body == undefined ? false : data.email_transformed_body);
	$('#outbound-step').find('#outboundTransformedBodyhtml').prop('checked', data.email_transformed_body_html == undefined ? false : data.email_transformed_body_html);
	$('#outbound-step').find('#outboundRequestToEndPointUrl').prop('checked', data.email_request_endpoint_url_information == undefined ? false : data.email_request_endpoint_url_information);
	$('#outbound-step').find('#outboundResponse').prop('checked', data.email_response == undefined ? false : data.email_response);
	$('#outbound-step').find('#outboundResponsehtml').prop('checked', data.email_response_html == undefined ? false : data.email_response_html);
	$('#outbound-step').find('#outboundTransformedResponse').prop('checked', data.email_transformed_response == undefined ? false : data.email_transformed_response);
	$('#outbound-step').find('#outboundTransformedResponsehtml').prop('checked', data.email_transformed_response_html == undefined ? false : data.email_transformed_response_html);
	$('#outbound-step').find('#outboundValidationMessage').prop('checked', data.email_validation_message == undefined ? false : data.email_validation_message);
	$('#outbound-step').find('#outboundLogs').prop('checked', data.email_logs == undefined ? false : data.email_logs);

	if (data.is_active === undefined || data.is_active === 'InActive') {
		$('#outbound-step').find('#is_active_outbound').prop('checked', false);
	} else {
		$('#outbound-step').find('#is_active_outbound').prop('checked', true);
	}
}

async function fillScheduleUI(data) {
	$('input[name="s_configure_inbound"][value="' + data.Schedule_configure_inbound + '"]').prop('checked', true);

	if (data.Schedule_configure_inbound == 'click_by_user') {
		$('div.relation-schedule-open').hide();
	} else {
		$('div.relation-schedule-open').show();
	}

	if (data.Schedule_configure_outbound == 'click_by_user') {
		$('div.relation-outbound-schedule-open').hide();
	} else {
		$('div.relation-outbound-schedule-open').show();
	}

	$('input[name="schedule_type_inbound"][value="' + data.schedule_type_inbound + '"]').prop('checked', true);

	if (data.schedule_type_inbound == 'OneTime') {
		$('#inbound-data-recurring').hide();
		$('#inbound-data-one-time').show();
		$('#one_time_occurrence_inbound_date').val(data.one_time_occurrence_inbound_date);
		$('#one_time_occurrence_inbound_time').val(data.one_time_occurrence_inbound_time);
	} else {
		$('#inbound-data-recurring').show();
		$('#inbound-data-one-time').hide();
	}

	if (data.schedule_type_outbound == 'OneTime') {
		$('#outbound-data-recurring').hide();
		$('#outbound-data-one-time').show();
		$('#one_time_occurrence_outbound_date').val(data.one_time_occurrence_outbound_date);
		$('#one_time_occurrence_outbound_time').val(data.one_time_occurrence_outbound_time);
	} else {
		$('#outbound-data-recurring').show();
		$('#outbound-data-one-time').hide();
	}

	function getDropdownParent(el) {
		const modal = $(el).closest('.modal');
		return modal.length ? modal : $('body');
	}

	['#occurs_time_inbound', '#occurs_time_outbound'].forEach(function (selector) {
		const parent = getDropdownParent(selector);

		$(selector).select2({
			dropdownParent: parent
		});
	});
	$('input[name="s_configure_outbound"][value="' + data.Schedule_configure_outbound + '"]').prop('checked', true);
	$('input[name="schedule_type_outbound"][value="' + data.schedule_type_outbound + '"]').prop('checked', true);
	$('#day_frequency_inbound_count').val(data.day_frequency_inbound_count);
	$('#day_frequency_outbound_count').val(data.day_frequency_outbound_count);
	$('#weekly_frequency_inbound_count').val(data.weekly_frequency_inbound_count);
	$('#weekly_frequency_outbound_count').val(data.weekly_frequency_outbound_count);
	$('#monthly_frequency_day_inbound').val(data.monthly_frequency_day_inbound);
	$('#monthly_frequency_day_outbound').val(data.monthly_frequency_day_outbound);
	$('#monthly_frequency_day_inbound_count').val(data.monthly_frequency_day_inbound_count);
	$('#monthly_frequency_day_outbound_count').val(data.monthly_frequency_day_outbound_count);
	$('#monthly_frequency_the_inbound_count').val(data.monthly_frequency_the_inbound_count);
	$('#monthly_frequency_the_outbound_count').val(data.monthly_frequency_the_outbound_count);

	$('input[name="daily_frequency_type_inbound"][value="' + data.daily_frequency_type_inbound + '"]').prop('checked', true);
	$('input[name="daily_frequency_type_outbound"][value="' + data.daily_frequency_type_outbound + '"]').prop('checked', true);
	$('#daily_frequency_once_time_inbound').val(data.daily_frequency_once_time_inbound);
	$('#daily_frequency_once_time_outbound').val(data.daily_frequency_once_time_outbound);

	if ($('input[name="daily_frequency_type_inbound"]:checked').val() == 'Occurs every') {
		$('#daily_frequency_once_time_inbound').hide();
		$('#recursEveryDiv').show();
		$('#startingEndingDiv').show();
		$('#daily_frequency_every_time_unit_inbound').val(data.daily_frequency_every_time_unit_inbound).change();
		$('#daily_frequency_every_time_count_inbound').val(data.daily_frequency_every_time_count_inbound);
		$('#daily_frequency_every_time_count_start_inbound').val(data.daily_frequency_every_time_count_start_inbound);
		$('#daily_frequency_every_time_count_end_inbound').val(data.daily_frequency_every_time_count_end_inbound);
	}

	if ($('input[name="daily_frequency_type_outbound"]:checked').val() == 'Occurs every') {
		$('#daily_frequency_once_time_outbound').hide();
		$('#recursEveryDivOutbound').show();
		$('#startingEndingDivOutbound').show();
		$('#daily_frequency_every_time_unit_outbound').val(data.daily_frequency_every_time_unit_outbound).change();
		$('#daily_frequency_every_time_count_outbound').val(data.daily_frequency_every_time_count_outbound);
		$('#daily_frequency_every_time_count_start_outbound').val(data.daily_frequency_every_time_count_start_outbound);
		$('#daily_frequency_every_time_count_end_outbound').val(data.daily_frequency_every_time_count_end_outbound);
	}

	$('#occurs_time_inbound').val(data.occurs_inbound).trigger('change');
	$('#occurs_time_outbound').val(data.occurs_outbound).trigger('change');

	$('#schedule_setting_id').val(data._id);

	if (data.duration_inbound_start_date != undefined) {
		$('#duration_inbound_start_date').val(data.duration_inbound_start_date);
		$('#duration_inbound_end_date').attr('min', data.duration_inbound_start_date);
		inbound_start_date = data.duration_inbound_start_date;
	}

	if (data.duration_inbound_is_end_date != undefined) {
		$('input[name="duration_inbound_is_end_date"][value="' + data.duration_inbound_is_end_date + '"]').prop('checked', true);

		if (data.duration_inbound_is_end_date == 'no_end_date') {
			$('#duration_inbound_end_date').addClass('hidden');
		} else {
			$('#duration_inbound_end_date').removeClass('hidden');
		}
	}

	if (data.duration_inbound_end_date != undefined) {
		$('#duration_inbound_end_date').val(data.duration_inbound_end_date);
	}

	if (data.duration_outbound_start_date != undefined) {
		$('#duration_outbound_start_date').val(data.duration_outbound_start_date);
		$('#duration_outbound_end_date').attr('min', data.duration_outbound_start_date);
		outbound_start_date = data.duration_outbound_start_date;
	}

	if (data.duration_outbound_is_end_date != undefined) {
		$('input[name="duration_outbound_is_end_date"][value="' + data.duration_outbound_is_end_date + '"]').prop('checked', true);

		if (data.duration_outbound_is_end_date == 'no_end_date') {
			$('#duration_outbound_end_date').addClass('hidden');
		} else {
			$('#duration_outbound_end_date').removeClass('hidden');
		}
	}

	if (data.duration_outbound_end_date != undefined) {
		$('#duration_outbound_end_date').val(data.duration_outbound_end_date);
	}

	if (data.occurs_inbound == 'weekly') {
		$(data.occurs_weekly_fields_inbound).each(function (_, item) {
			$('input[name="occurs_weekly_fields_inbound"][value="' + item.day + '"]').prop('checked', true);
		});
	}

	if (data.occurs_outbound == 'weekly') {
		$(data.occurs_weekly_fields_outbound).each(function (_, item) {
			$('input[name="occurs_weekly_fields_outbound"][value="' + item.day + '"]').prop('checked', true);
		});
	}

	if (data.occurs_inbound == 'monthly') {
		$(data.monthly_field_setting_inbound).each(function (_, item) {
			if (item.inbound_monthly_day == 'the') {
				$('input[name="inbound_monthly_day"][value="The"]').prop('checked', true).trigger('change');
				$('#day_txt_box_inbound').hide();
				$('#the_section_inbound').show();
				$('#the_day_of').val(item.the_day_of).change();
				$('#the_days').val(item.the_days).change();
			} else {
				$('#the_section_inbound').hide();
				$('#day_txt_box_inbound').show();
			}
		});
	}

	if (data.occurs_outbound == 'monthly') {
		$(data.monthly_field_setting_outbound).each(function (_, item) {
			if (item.outbound_monthly_day == 'the') {
				$('input[name="outbound_monthly_day"][value="The"]').prop('checked', true).trigger('change');
				$('#day_txt_box_outbound').hide();
				$('#the_section_outbound').show();
				$('#the_day_of_outbound').val(item.the_day_of).change();
				$('#the_days_outbound').val(item.the_days).change();
			} else {
				$('#the_section_outbound').hide();
				$('#day_txt_box_outbound').show();
			}
		});
	}

	if (data.enableLog === undefined || data.enableLog === 'off') {
		$('#schedule-step').find('#ScheduleEnableLogs').prop('checked', false);
	} else {
		$('#schedule-step').find('#ScheduleEnableLogs').prop('checked', true);
	}
}

$(document).ready(function () {
	setupImportWizard();
	setupBSStepper();

	// Initialize Select2 controls inside the modal
	$('#import-item-modal-slide-in').on('shown.bs.modal', function () {
		$('#import-select-company, #import-select-project, #import-select-item').select2({
			width: '100%',
			placeholder: 'Select an option',
			dropdownParent: $('#import-item-modal-slide-in')
		});
	});
});

function setupBSStepper() {
	const el = document.querySelector('#import-item-stepper');
	if (!el) return;

	// Initialize Stepper
	importStepper = new Stepper(el, {
		linear: false,
		animation: true
	});

	// NEXT BUTTON
	$(el).find('.btn-next').off('click').on('click', function () {
		if (validateCurrentStep()) {
			importStepper.next();
			setTimeout(updateImportStepperButtons, 150);
		}
	});

	// PREVIOUS BUTTON
	$(el).find('.btn-prev').off('click').on('click', function () {
		importStepper.previous();
		setTimeout(updateImportStepperButtons, 150);
	});

	el.addEventListener('show.bs.stepper', updateImportStepperButtons);
	el.addEventListener('shown.bs.stepper', updateImportStepperButtons);
	updateImportStepperButtons();
}

function setupImportWizard() {
	// ---------- FILE UPLOAD ----------
	$(document).on('change', '#importFile', function () {
		clearFieldError($(this));
		const file = this.files[0];

		if (!file) return;

		if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
			displayFieldError($(this), 'Only JSON files are allowed');
			return;
		}

		const reader = new FileReader();
		reader.onload = function (e) {
			try {
				const data = JSON.parse(e.target.result);
				importWizardState.fileData = data;
				importWizardState.fileItems = Array.isArray(data) ? data : [data];

				// Update file label
				$('#importFile').siblings('.custom-file-label').text(file.name);
				clearFieldError($('#importFile'));

				// Auto-detect and pre-fill from JSON
				autoDetectFromJSON();

			} catch (err) {
				displayFieldError($('#importFile'), 'Invalid JSON: ' + err.message);
			}
		};
		reader.readAsText(file);
	});

	// ---------- COMPANY TYPE CHANGE ----------
	$(document).on('change', 'input[name="companyType"]', function () {
		importWizardState.companyType = this.value;
		$('#company-existing-group').toggle(this.value === 'existing');
		$('#company-new-group').toggle(this.value === 'new');
		$('#import-select-company').prop('required', this.value === 'existing');

		if (this.value === 'new') {
			$('#new-company-code').val(importWizardState.newCompanyCode || '');
			$('#new-company-name').val(importWizardState.newCompanyName || '');

			// Force new project & new item
			importWizardState.projectType = 'new';
			$('input[name="projectType"]').prop('disabled', true);
			$('#new-project-radio').prop('checked', true).trigger('change');
		} else {
			$('input[name="projectType"]').prop('disabled', false);
			loadAllCompanies();
		}
	});

	// ---------- COMPANY SELECTION ----------
	$(document).on('change', '#import-select-company', function () {
		clearFieldError($(this));
		importWizardState.selectedCompany = this.value || null;
		importWizardState.selectedProject = null;
		importWizardState.selectedItem = null;

		// Reset project and item selects
		$('#import-select-project').val('').trigger('change.select2');
		$('#import-select-item').val('').trigger('change.select2');

		if (this.value) {
			loadCompanyProjects(this.value);
		}
	});

	// ---------- PROJECT TYPE CHANGE ----------
	$(document).on('change', 'input[name="projectType"]', function () {
		importWizardState.projectType = this.value;
		$('#project-existing-group').toggle(this.value === 'existing');
		$('#project-new-group').toggle(this.value === 'new');
		$('#import-select-project').prop('required', this.value === 'existing');

		if (this.value === 'new') {
			$('#new-project-code').val(importWizardState.newProjectCode || '');
			$('#new-project-name').val(importWizardState.newProjectName || '');

			// Force new item
			importWizardState.itemType = 'new';
			$('input[name="itemType"]').prop('disabled', true);
			$('#new-item-radio').prop('checked', true).trigger('change');
		} else {
			$('input[name="itemType"]').prop('disabled', false);
		}
	});

	// ---------- PROJECT SELECTION ----------
	$(document).on('change', '#import-select-project', function () {
		clearFieldError($(this));
		importWizardState.selectedProject = this.value || null;
		importWizardState.selectedItem = null;

		// Reset item select
		$('#import-select-item').val('').trigger('change.select2');

		if (this.value && this.value !== ' ') {
			loadProjectItems();
		}
	});

	// ---------- ITEM TYPE CHANGE ----------
	$(document).on('change', 'input[name="itemType"]', function () {
		importWizardState.itemType = this.value;
		$('#item-existing-group').toggle(this.value === 'existing');
		$('#item-new-group').toggle(this.value === 'new');
		$('#import-select-item').prop('required', this.value === 'existing');

		if (this.value === 'new' && importWizardState.fileItems.length) {
			$('#new-item-code').val(importWizardState.newItemCode || '');
			$('#new-item-name').val(importWizardState.newItemName || '');
		}

		if (this.value === 'existing' && importWizardState.selectedProject) {
			loadProjectItems();
		}
	});

	// ---------- ITEM SELECTION ----------
	$(document).on('change', '#import-select-item', function () {
		clearFieldError($(this));
		importWizardState.selectedItem = this.value || null;
	});

	// ---------- TEXT INPUT CHANGE ----------
	$(document).on('input', '#new-company-code, #new-company-name, #new-project-code, #new-project-name, #new-item-code, #new-item-name', function () {
		clearFieldError($(this));

		const value = this.value.trim();
		const id = this.id;

		if (id === 'new-company-code') importWizardState.newCompanyCode = value;
		else if (id === 'new-company-name') importWizardState.newCompanyName = value;
		else if (id === 'new-project-code') importWizardState.newProjectCode = value;
		else if (id === 'new-project-name') importWizardState.newProjectName = value;
		else if (id === 'new-item-code') importWizardState.newItemCode = value;
		else if (id === 'new-item-name') importWizardState.newItemName = value;
	});

	// ---------- OPEN MODAL ----------
	$(document).on('click', '#import_item', function () {
		resetImportWizard();

		// Pre-fill company dropdown
		if (companyListCommon.length > 0) {
			populateSelect('#import-select-company', companyListCommon, 'name', null);
		}

		$('#import-item-modal-slide-in').modal('show');
	});

	// ---------- CONFIRM IMPORT ----------
	$(document).on('click', '#import-wizard-confirm-btn', function () {
		if (!validateCurrentStep()) {
			return;
		}
		executeImport();
	});

	// ---------- CLOSE MODAL ----------
	$('#import-item-modal-slide-in').on('hidden.bs.modal', resetImportWizard);
}

// AUTO-DETECT FROM JSON
function autoDetectFromJSON() {
	if (!importWizardState.fileItems || importWizardState.fileItems.length === 0) {
		return;
	}

	const firstItem = importWizardState.fileItems[0];

	// Extract company, project, item data from JSON
	const jsonCompany = firstItem.company || null;
	const jsonProject = firstItem.project || null;
	const jsonItem = firstItem.item || null;

	// Store JSON IDs for comparison
	importWizardState.jsonCompanyId = jsonCompany?._id || null;
	importWizardState.jsonProjectId = jsonProject?._id || null;
	importWizardState.jsonItemId = jsonItem?._id || null;

	// Pre-fill company data
	if (jsonCompany) {
		importWizardState.newCompanyCode = jsonCompany.code || '';
		importWizardState.newCompanyName = jsonCompany.name || '';

		// Check if company exists in database
		checkIfCompanyExists(jsonCompany._id);
	}

	// Pre-fill project data
	if (jsonProject) {
		importWizardState.newProjectCode = jsonProject.code || '';
		importWizardState.newProjectName = jsonProject.name || '';
	}

	// Pre-fill item data
	if (jsonItem) {
		importWizardState.newItemCode = jsonItem.ItemCode || '';
		importWizardState.newItemName = jsonItem.ItemName || '';

		$('#new-item-code').val(importWizardState.newItemCode);
		$('#new-item-name').val(importWizardState.newItemName);
	}
}

// CHECK IF COMPANY EXISTS
function checkIfCompanyExists(companyId) {
	if (!companyId) return;

	$.ajax({
		url: '/master/companies/check-exists',
		method: 'POST',
		contentType: 'application/json',
		data: JSON.stringify({ companyId: companyId }),
		success: function (response) {
			if (response.status === 1 && response.exists) {
				// Company exists - select it and set to existing
				importWizardState.companyType = 'existing';
				importWizardState.selectedCompany = companyId;

				$('input[name="companyType"][value="existing"]').prop('checked', true).trigger('change');
				$('#import-select-company').val(companyId).trigger('change.select2');

				// Now check project
				checkIfProjectExists(companyId, importWizardState.jsonProjectId);
			} else {
				// Company doesn't exist - set to new
				importWizardState.companyType = 'new';
				$('input[name="companyType"][value="new"]').prop('checked', true).trigger('change');

				$('#new-company-code').val(importWizardState.newCompanyCode);
				$('#new-company-name').val(importWizardState.newCompanyName);
			}
		},
		error: function () {
			// On error, default to new company
			importWizardState.companyType = 'new';
			$('input[name="companyType"][value="new"]').prop('checked', true).trigger('change');
		}
	});
}

// CHECK IF PROJECT EXISTS
function checkIfProjectExists(companyId, projectId) {
	if (!companyId || !projectId) return;

	$.ajax({
		url: '/master/projects/check-exists',
		method: 'POST',
		contentType: 'application/json',
		data: JSON.stringify({ companyId: companyId, projectId: projectId }),
		success: function (response) {
			if (response.status === 1 && response.exists) {
				// Project exists - select it and set to existing
				importWizardState.projectType = 'existing';
				importWizardState.selectedProject = projectId;

				$('input[name="projectType"][value="existing"]').prop('checked', true).trigger('change');

				// Load projects and select
				loadCompanyProjects(companyId, function () {
					$('#import-select-project').val(projectId).trigger('change.select2');

					// Now check item
					checkIfItemExists(companyId, projectId, importWizardState.jsonItemId);
				});
			} else {
				// Project doesn't exist - set to new
				importWizardState.projectType = 'new';
				$('input[name="projectType"][value="new"]').prop('checked', true).trigger('change');

				$('#new-project-code').val(importWizardState.newProjectCode);
				$('#new-project-name').val(importWizardState.newProjectName);
			}
		},
		error: function () {
			// On error, default to new project
			importWizardState.projectType = 'new';
			$('input[name="projectType"][value="new"]').prop('checked', true).trigger('change');
		}
	});
}

// CHECK IF ITEM EXISTS
function checkIfItemExists(companyId, projectId, itemId) {
	if (!companyId || !projectId || !itemId) return;

	$.ajax({
		url: '/projects/check-item-exists',
		method: 'POST',
		contentType: 'application/json',
		data: JSON.stringify({ companyId: companyId, projectId: projectId, itemId: itemId }),
		success: function (response) {
			if (response.status === 1 && response.exists) {
				// Item exists - select it and set to existing
				importWizardState.itemType = 'existing';
				importWizardState.selectedItem = itemId;

				$('input[name="itemType"][value="existing"]').prop('checked', true).trigger('change');

				// Load items and select
				loadProjectItems(function () {
					$('#import-select-item').val(itemId).trigger('change.select2');
				});
			} else {
				// Item doesn't exist - set to new
				importWizardState.itemType = 'new';
				$('input[name="itemType"][value="new"]').prop('checked', true).trigger('change');

				$('#new-item-code').val(importWizardState.newItemCode);
				$('#new-item-name').val(importWizardState.newItemName);
			}
		},
		error: function () {
			// On error, default to new item
			importWizardState.itemType = 'new';
			$('input[name="itemType"][value="new"]').prop('checked', true).trigger('change');
		}
	});
}

// VALIDATION
function validateCurrentStep() {
	clearAllErrors();
	let hasError = false;
	const activeStep = $('#import-item-stepper .step.active').data('target');

	// STEP 1 - File Upload
	if (activeStep === '#import-step-1') {
		if (!importWizardState.fileData || importWizardState.fileItems.length === 0) {
			displayFieldError($('#importFile'), 'Please upload a valid JSON file');
			hasError = true;
		}
	}

	// STEP 2 - Target Selections
	if (activeStep === '#import-step-2') {
		// COMPANY VALIDATION
		if (importWizardState.companyType === 'existing') {
			if (!importWizardState.selectedCompany) {
				displayFieldError($('#import-select-company'), 'Please select a Company');
				hasError = true;
			}
		} else {
			if (!$('#new-company-code').val().trim()) {
				displayFieldError($('#new-company-code'), 'Company Code is required');
				hasError = true;
			}
			if (!$('#new-company-name').val().trim()) {
				displayFieldError($('#new-company-name'), 'Company Name is required');
				hasError = true;
			} else {
				importWizardState.newCompanyName = $('#new-company-name').val().trim();
			}
		}

		// PROJECT VALIDATION
		if (importWizardState.projectType === 'existing') {
			if (!importWizardState.selectedProject && importWizardState.selectedProject !== ' ') {
				displayFieldError($('#import-select-project'), 'Please select a Project');
				hasError = true;
			}
		} else {
			if (!$('#new-project-code').val().trim()) {
				displayFieldError($('#new-project-code'), 'Project Code is required');
				hasError = true;
			}
			if (!$('#new-project-name').val().trim()) {
				displayFieldError($('#new-project-name'), 'Project Name is required');
				hasError = true;
			} else {
				importWizardState.newProjectName = $('#new-project-name').val().trim();
			}
		}

		// ITEM VALIDATION
		if (importWizardState.itemType === 'existing') {
			if (!importWizardState.selectedItem) {
				displayFieldError($('#import-select-item'), 'Please select an Item');
				hasError = true;
			}
		} else {
			if (!$('#new-item-code').val().trim()) {
				displayFieldError($('#new-item-code'), 'Item Code is required');
				hasError = true;
			}
			if (!$('#new-item-name').val().trim()) {
				displayFieldError($('#new-item-name'), 'Item Name is required');
				hasError = true;
			} else {
				importWizardState.newItemCode = $('#new-item-code').val().trim();
				importWizardState.newItemName = $('#new-item-name').val().trim();
			}
		}
	}

	// Scroll to first error
	if (hasError) {
		document.querySelector('.is-invalid')?.scrollIntoView({
			behavior: 'smooth',
			block: 'center'
		});
	}

	return !hasError;
}

function displayFieldError($field, msg) {
	$field.addClass('is-invalid');

	if ($field.hasClass('select2-hidden-accessible')) {
		// Select2 field
		const $container = $field.next('.select2-container');

		$container.find('.select2-selection').css('border-color', '#ea5455');

		// Remove existing error
		$container.next('.invalid-feedback').remove();

		// Append error after select2 container
		$container.after(`<div class="invalid-feedback d-block">${msg}</div>`);
	} else {
		// Normal input fields
		$field.after(`<div class="invalid-feedback d-block">${msg}</div>`);
	}
}

function clearFieldError($field) {
	$field.removeClass('is-invalid');

	if ($field.hasClass('select2-hidden-accessible')) {
		const $container = $field.next('.select2-container');
		$container.find('.select2-selection').css('border-color', '');
		$container.next('.invalid-feedback').remove();
	} else {
		$field.siblings('.invalid-feedback').remove();
	}
}

function clearAllErrors() {
	$('#import-item-stepper').find('.is-invalid').removeClass('is-invalid').end().find('.invalid-feedback').remove();
	$('.select2-container .select2-selection').css('border-color', '');
}

function updateImportStepperButtons() {
	const isOnLastStep = $('#import-step-2').hasClass('active');
	const $nextBtn = $('.btn-next');
	const $confirmBtn = $('#import-wizard-confirm-btn');
	const $prevBtn = $('.btn-prev');

	if (isOnLastStep) {
		$nextBtn.hide();
		$confirmBtn.show();
		$prevBtn.prop('disabled', false);
	} else {
		$nextBtn.show();
		$confirmBtn.hide();
		$prevBtn.prop('disabled', false);
	}
}

// DATA LOADING FUNCTIONS
function loadAllCompanies() {
	if (typeof getAllCompanies === 'function') {
		getAllCompanies().then(r => {
			if (r.status === 1) {
				populateSelect('#import-select-company', r.data, 'name', importWizardState.selectedCompany);
			}
		});
	}
}

function loadCompanyProjects(companyId, callback) {
	return new Promise((resolve, reject) => {
		if (companyId) {
			$.ajax({
				url: '/master/projects/all-company-project',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ companyId }),
				success: function (response) {
					if (response.status == 1) {
						projectListCommon = response.data;
						populateSelect('#import-select-project', response.data, 'name', importWizardState.selectedProject || ' ', true);
						if (callback) callback();
						resolve();
					} else {
						if (callback) callback();
						reject(new Error(response.message));
					}
				},
				error: function (xhr, status, error) {
					if (callback) callback();
					reject(new Error(error));
				}
			});
		} else {
			resolve();
		}
	});
}

function loadProjectItems(callback) {
	return new Promise((resolve, reject) => {
		if (importWizardState.selectedProject && importWizardState.selectedProject !== ' ') {
			$.ajax({
				url: '/projects/item-name-list',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({
					companyId: importWizardState.selectedCompany,
					projectId: importWizardState.selectedProject
				}),
				success: function (response) {
					if (response.status == 1) {
						populateSelect('#import-select-item', response.data, 'ItemName', importWizardState.selectedItem, false);
						if (callback) callback();
						resolve();
					} else {
						if (callback) callback();
						reject(new Error(response.message));
					}
				},
				error: function (xhr, status, error) {
					if (callback) callback();
					reject(new Error(error));
				}
			});
		} else {
			resolve();
		}
	});
}

function populateSelect(selector, data, textField, selectedValue, addDefault = false) {
	const $sel = $(selector);
	$sel.empty();

	// Add default "Please Select" option
	const defaultOption = document.createElement('option');
	defaultOption.value = '';
	defaultOption.textContent = '-- Please Select --';
	$sel.append(defaultOption);

	// Add "Default" option ONLY for project select
	if (addDefault && selector === '#import-select-project') {
		const defaultSpecialOption = document.createElement('option');
		defaultSpecialOption.value = ' ';
		defaultSpecialOption.textContent = 'Default';
		defaultSpecialOption.setAttribute('data-name', 'Default');
		$sel.append(defaultSpecialOption);
	}

	// Add data options
	data.forEach(item => {
		const option = document.createElement('option');
		option.value = item._id;
		option.textContent = item[textField];
		option.setAttribute('data-name', item[textField]);
		if (item.code) option.setAttribute('data-code', item.code);
		if (item.ItemCode) option.setAttribute('data-code', item.ItemCode);
		$sel.append(option);
	});

	// Set selected value
	if (selectedValue) {
		$sel.val(selectedValue).trigger('change.select2');
	} else {
		$sel.trigger('change.select2');
	}
}

// EXECUTE IMPORT
function executeImport() {
	// Prepare import payload
	const importPayload = {
		company: {
			type: importWizardState.companyType,
			id: importWizardState.selectedCompany,
			code: importWizardState.newCompanyCode,
			name: importWizardState.newCompanyName
		},
		project: {
			type: importWizardState.projectType,
			id: importWizardState.selectedProject,
			code: importWizardState.newProjectCode,
			name: importWizardState.newProjectName
		},
		item: {
			type: importWizardState.itemType,
			id: importWizardState.selectedItem,
			code: importWizardState.newItemCode,
			name: importWizardState.newItemName
		},
		items: importWizardState.fileItems
	};

	console.log('Import Payload:', importPayload);

	// Show loading indicator
	$('#import-wizard-confirm-btn').prop('disabled', true).html('<span class="spinner-border spinner-border-sm mr-1"></span>Importing...');

	$.ajax({
		url: '/projects/item-import',
		method: 'POST',
		contentType: 'application/json',
		data: JSON.stringify(importPayload),
		success: function (response) {
			$('#import-wizard-confirm-btn').prop('disabled', false).html('<i data-feather="check" class="align-middle mr-1"></i><span>Import</span>');
			if (response.status === 1) {
				location.reload();
			} else {
				showError('Error', response.message || 'Import failed');
			}
		},
		error: function (xhr) {
			$('#import-wizard-confirm-btn').prop('disabled', false).html('<i data-feather="check" class="align-middle mr-1"></i><span>Import</span>');
			showError('Error', xhr?.responseJSON?.message || 'An error occurred during import');
		}
	});
}

// RESET WIZARD
function resetImportWizard() {
	// Reset state
	Object.keys(importWizardState).forEach(k => {
		if (['fileData', 'fileItems'].includes(k)) {
			importWizardState[k] = k === 'fileItems' ? [] : null;
		} else if (k.includes('Type')) {
			importWizardState[k] = k === 'itemType' ? 'new' : 'existing';
		} else {
			importWizardState[k] = null;
		}
	});

	// Reset form
	clearAllErrors();
	$('#importForm')[0].reset();
	$('#importFile').siblings('.custom-file-label').text('Choose file...');
	$('#import-select-company, #import-select-project, #import-select-item').val('').trigger('change.select2');

	// Reset radio buttons
	$('input[name="companyType"][value="existing"]').prop('checked', true).trigger('change');
	$('input[name="projectType"]').prop('disabled', false);
	$('input[name="projectType"][value="existing"]').prop('checked', true).trigger('change');
	$('input[name="itemType"][value="new"]').prop('checked', true).trigger('change');

	// Reset stepper
	if (importStepper) importStepper.to(1);
}

$('#item_select_all').on('change', function () {
	const isChecked = $(this).is(':checked');
	$('.item-checkbox').not('#item_select_all').prop('checked', isChecked);

	selectedItemIds = [];
	if (isChecked) {
		$('.item-checkbox').not('#item_select_all').each(function () {
			selectedItemIds.push($(this).data('item-id'));
		});
	}

	renderPagination(parseInt(currentPage), parseInt(perPage), totalRecord);
});

// Individual checkbox handler
$(document).on('change', '.item-checkbox:not(#item_select_all)', function () {
	const $checkboxes = $('.item-checkbox').not('#item_select_all');
	const totalItems = $checkboxes.length;
	const checkedItems = $checkboxes.filter(':checked').length;

	selectedItemIds = [];
	$checkboxes.filter(':checked').each(function () {
		selectedItemIds.push($(this).data('item-id'));
	});

	$('#item_select_all').prop('checked', totalItems === checkedItems && totalItems > 0);
});

// Export button handler
$('#export_item').on('click', function () {
	selectedItemIds = [];
	$('.item-checkbox').not('#item_select_all').filter(':checked').each(function () {
		selectedItemIds.push($(this).data('item-id'));
	});
	const selectedCount = selectedItemIds.length;

	if (selectedCount > 0) {
		$.ajax({
			url: `/projects/item-list`,
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ itemIds: selectedItemIds }),
			success: function (response) {
				if (response.status == 1) {
					if (response.data) {
						const currentDate = Date.now()
						const filename = `exported_items_${currentDate}.json`;
						const jsonBlob = new Blob(
							[JSON.stringify(response.data, null, 2)],
							{ type: 'application/json' }
						);

						const downloadLink = document.createElement('a');
						downloadLink.href = URL.createObjectURL(jsonBlob);
						downloadLink.download = filename;
						document.body.appendChild(downloadLink);
						downloadLink.click();
						document.body.removeChild(downloadLink);
					}

					$('#item_select_all').prop('checked', false).trigger('change');
					$('.item-checkbox').not('#item_select_all').prop('checked', false).trigger('change');
					selectedItemIds = [];

					if ($.fn.uniform) {
						$.uniform.update('.item-checkbox');
					}

					Swal.fire({
						title: 'Success!',
						text: response.message,
						icon: 'success',
						customClass: {
							confirmButton: 'btn btn-primary'
						},
						buttonsStyling: false,
						timer: 1200
					});
				} else {
					Swal.fire({
						title: 'Error!',
						text: response.message,
						icon: 'error',
						customClass: {
							confirmButton: 'btn btn-primary'
						},
						buttonsStyling: false,
						timer: 1200
					});
				}

				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });
			},
			error: function (xhr, status, error) {
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });

				Swal.fire({
					title: 'Error!',
					text: xhr?.responseJSON?.message,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});

				return false;
			}
		});
	}
});

const urlPath = window.location.pathname;
if (urlPath !== "/logs") {
	itemLogPage = true;
} else {
	itemLogPage = false;
}

$('body').on('change', '.is-active-button', function () {
	$this = $(this);
	Swal.fire({
		title: 'Are you sure?',
		text: ($this.is(':checked')) ? `You want to active this item?` : `You want to inactive this item?`,
		icon: 'info',
		showCancelButton: true,
		confirmButtonText: 'Yes',
		customClass: {
			confirmButton: 'btn btn-primary',
			cancelButton: 'btn btn-outline-danger ml-1'
		},
		buttonsStyling: false
	}).then(function (result) {
		if (result.value) {
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({ 'display': 'block' });

			const isActive = ($this.is(':checked')) ? true : false;
			const itemId = $this.data('id');

			$.ajax({
				url: `/projects/status/${itemId}`,
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ isActive: isActive }),
				success: function (response) {
					if (response.status == 1) {
						Swal.fire({
							title: 'Success!',
							text: response.message,
							icon: 'success',
							customClass: {
								confirmButton: 'btn btn-primary'
							},
							buttonsStyling: false,
							timer: 1200
						});
					} else {
						Swal.fire({
							title: 'Error!',
							text: response.message,
							icon: 'error',
							customClass: {
								confirmButton: 'btn btn-primary'
							},
							buttonsStyling: false,
							timer: 1200
						});
					}

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });
				},
				error: function (xhr, status, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });

					Swal.fire({
						title: 'Error!',
						text: xhr?.responseJSON?.message,
						icon: 'error',
						customClass: {
							confirmButton: 'btn btn-primary'
						},
						buttonsStyling: false,
						timer: 1200
					});

					return false;
				}
			});
		}
	});
});

if (typeof bsStepper !== undefined && bsStepper !== null) {
	for (let el = 0; el < bsStepper.length; ++el) {
		bsStepper[el].addEventListener('show.bs-stepper', function (event) {
			const index = event.detail.indexStep;
			const numberOfSteps = $(event.target).find('.step').length - 1;
			let line = $(event.target).find('.step');

			for (let i = 0; i < index; i++) {
				line[i].classList.add('crossed');

				for (let j = index; j < numberOfSteps; j++) {
					line[j].classList.remove('crossed');
				}
			}
			if (event.detail.to == 0) {
				for (let k = index; k < numberOfSteps; k++) {
					line[k].classList.remove('crossed');
				}
				line[0].classList.remove('crossed');
			}
		});
	}
}

select.each(function () {
	let $this = $(this);
	$this.select2({
		placeholder: '-- Please Select --',
		dropdownParent: $this.parent()
	});
});

selectClearble.each(function () {
	let $this = $(this);
	$this.select2({
		placeholder: '-- Please Select --',
		dropdownParent: $this.parent(),
		allowClear: $this.val() !== ' '
	});
});

$('#select-item-company').on('change.select2', async function () {
	if (!$(this).data('programmaticChange')) {
		const selectedCompany = $(this).val();
		let companyCodefind = companyOptionGlobal.find((item) => item._id == selectedCompany);
		reponseGloabalSetting = await getGeneralSettings(companyCodefind.companyCode);
		const $selectedProject = $('#select-item-project');
		let currentProjectValue = $selectedProject.val();
		if (currentProjectValue && previousCompany == selectedCompany) {
			await getProjects(selectedCompany, currentProjectValue, false);
		} else {
			await getProjects(selectedCompany, '', true);
		}
	}
	$('#select-item-company').select2('close');
});

$('body').on('select2:open', '#select-item-company', function () {
	const dropdown = $(this).data('select2').dropdown.$search[0].parentElement;
	if (!$(dropdown).find('.add-new-item-btn').length) {
		$(dropdown).append(`
			<button style="width: 100%" type="button" class="btn btn-primary add-new-item-btn mt-1" onClick="createCompany()">Create Company</button>
		`);
	}
});

$('body').on('click', '#item-company-edit-button', function () {
	const companySelectedOption = $('#select-item-company').find('option:selected');
	const companySelectedValue = companySelectedOption.val();
	if (companySelectedValue) {
		let find = companyOptionGlobal.find((item) => item._id == companySelectedValue);
		if (find) editCompanyItem(find);
	}
});

function createCompany() {
	isCompanyPage = false;
	clearFormFieldsCompany();
	$('#select-item-company').select2('close');
	$('#company-create-modal-slide-in').modal('show');
}

async function updateCompanyOptions() {
	const $selectedCompany = $('#select-item-company');
	let currentCompanyValue = $selectedCompany.val();
	await getAllCompanies()
		.then(responseCompanies => {
			if (responseCompanies.status === 1) {
				const selectCompany = document.getElementById('select-item-company');
				selectCompany.innerHTML = '<option value="">-- Please Select --</option>';
				responseCompanies.data.forEach(item => {
					const option = document.createElement('option');
					option.value = item._id;
					option.textContent = item.name;
					option.setAttribute('data-name', item.name);
					selectCompany.appendChild(option);
				});
				companyOptionGlobal = responseCompanies.data || [];
			}
		}).catch(error => {
			console.error('Error fetching companies:', error);
		});
	previousCompany = currentCompanyValue;
	$selectedCompany.val(currentCompanyValue).trigger('change');
}

function editCompanyItem(companyData) {
	isCompanyPage = false;
	clearErrors();
	const data = companyData;
	$('#company-id').val(data._id);
	if (data.code) {
		$('#company-code').val(data.code);
	} else {
		$('#company-code').val('');
	}

	$('#company-name').val(data.name);
	$('#sequence').val(data.sequence);
	$('#company-description').val(data.description);
	$('#default-project-prefix').val(data.defaultProjectPrefix);

	if (data.isDisableDefaultProjectPrefix) {
		$('#is-disable-default-project-prefix').prop('checked', true);
	} else {
		$('#is-disable-default-project-prefix').prop('checked', false);
	}

	if (data.isUrlPerfix) {
		$('#is-disable-company-urlprefix').prop('checked', true);
	} else {
		$('#is-disable-company-urlprefix').prop('checked', false);
	}

	if (data.isActive) {
		$('#is-company-active').prop('checked', true);
	} else {
		$('#is-company-active').prop('checked', false);
	}

	companyCompanyCode = data.companyCode;
	$('#select-item-company').select2('close');
	$('#company-modal-label').text('Update Company');
	$('#create-company').text('Update Company');
	$('#company-create-modal-slide-in').modal('show');
}

$('#select-item-project').on('change.select2', async function () {
	if (!$(this).data('programmaticChange')) {
		const selectedProject = $(this).val();
		const selectedCompany = $('#select-item-company').val();
		await fetchMappings(selectedCompany, selectedProject);

		const $selectedEnvironment = $('#select-item-environment');
		let currentEnvironmentValue = $selectedEnvironment.val();
		if (currentEnvironmentValue && prevoiusProject == selectedProject) {
			await getEnvironments(selectedCompany, selectedProject, currentEnvironmentValue, false);
		} else {
			await getEnvironments(selectedCompany, selectedProject, '', true);
		}

		let endPointTable = [];

		$('#outbound-endpoint-data-table').find('tbody tr').each(function (index) {
			let formDataObj = {};
			let $fieldset = $(this);

			formDataObj.status = $('input[name="outbound-endpoint-status"]', $fieldset).is(':checked');
			formDataObj.party = '';
			formDataObj.endpoint = $('input:text:eq(0)', $fieldset).val();
			formDataObj.inboundMapping = ' ';
			formDataObj.outboundMapping = ' ';
			formDataObj.inboundMappingVersion = '';
			formDataObj.outboundMappingVersion = '';
			formDataObj.default_response = $('input[name="outbound-default-response-status"]', $fieldset).is(':checked');
			formDataObj.triggerRules = [];
			formDataObj.specifyHeaders = [];
			endPointTable.push(formDataObj);
		});

		outboundEndpointDataRowCounter = 0;
		outboundEndPointMapping(endPointTable, true);
	}
	$('#select-item-project').select2('close');
});

$('body').on('select2:open', '#select-item-project', function () {
	const dropdown = $(this).data('select2').dropdown.$search[0].parentElement;
	if (!$(dropdown).find('.add-new-item-btn').length) {
		$(dropdown).append(`
			<button style="width: 100%" type="button" class="btn btn-primary add-new-item-btn mt-1" onClick="createProject()">Create Project</button>
		`);
	}
});

$('body').on('click', '#item-project-edit-button', function () {
	const projectSelectedOption = $('#select-item-project').find('option:selected');
	const projectSelectedValue = projectSelectedOption.val();
	if (projectSelectedValue) {
		let find = projectListOptions.find((item) => item._id == projectSelectedValue);
		if (find) editProjectItem(find);
	}
});

function createProject() {
	isProjectPage = false;
	clearErrors();
	$('#project-id').val('');
	const $selectedCompany = $('#select-item-company').val();
	if ($selectedCompany) {
		$('#select-project-company').val($selectedCompany).trigger('change');
	} else {
		$('#select-project-company').val('').trigger('change');
	}
	permissionLists = [];
	$('#project-code').val('');
	$('#project-name').val('');
	$('#project-sequence').val('');
	$('#project-description').val('	');
	$('#is-project-urlprefix').prop('checked', false);
	$('#permission-listing tbody').empty();
	$('#is-project-active').prop('checked', true);
	$('#project-modal-label').text('Create Project');
	$('#create-project').text('Create Project');
	$('#select-item-project').select2('close');
	$('#project-create-modal-slide-in').modal('show');
}

async function updateProjectOptions() {
	const $selectedCompany = $('#select-item-company').val();
	const $selectedProject = $('#select-item-project');
	let currentValue = $selectedProject.val();
	await getProjects($selectedCompany, '', true);
	prevoiusProject = currentValue;
	$selectedProject.val(currentValue).trigger('change');
}

function editProjectItem(projectData) {
	isProjectPage = false;
	clearErrors();
	$('#project-id').val(projectData._id);

	$.ajax({
		url: '/master/projects/get/' + projectData._id,
		method: 'GET',
		success: function (response) {
			if (response.status === 1) {
				const data = response?.data;
				const selectCompany = $('#select-project-company');
				selectCompany.val(data.companyId).trigger('change');

				$('#project-code').val(data.code);
				$('#project-name').val(data.name);
				$('#project-sequence').val(data.sequence);
				$('#project-description').val(data.description);

				if (data.isUrlPerfix) {
					$('#is-project-urlprefix').prop('checked', true);
				} else {
					$('#is-project-urlprefix').prop('checked', false);
				}

				if (data.isActive) {
					$('#is-project-active').prop('checked', true);
				} else {
					$('#is-project-active').prop('checked', false);
				}

				if (data.users) {
					permissionLists = data.users;
					const tableBody = $('#permission-listing tbody');
					tableBody.empty();

					permissionLists.forEach((item, index) => {
						tableBody.append(`
							<tr>
								<td>${item?.user || `User ` + item?.userId}</td>
								<td>${item?.permission || `Owner`}</td>
								<td>${dateFormat(item.createdAt)}</td>
								<td>${dateFormat(item.updatedAt)}</td>
								<td><button class="btn btn-outline-secondary btn-sm delete-permission" data-index="${index}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button></td>
							</tr>
						`);
					});
				}

				projectCompanyCode = data.companyCode;
			}
			$('.overlay, body').addClass('loaded');
			$('.overlay').css({ 'display': 'none' });
		},
		error: function (xhr, status, error) {
			$('.overlay, body').addClass('loaded');
			$('.overlay').css({ 'display': 'none' });
		}
	});

	$('#select-item-project').select2('close');
	$('#project-modal-label').text('Update Project');
	$('#create-project').text('Update Project');
	$('#project-create-modal-slide-in').modal('show');

}

$('#select-item-environment').on('change.select2', async function () {
	if (!$(this).data('programmaticChange')) {
		const selectedEnvironment = $(this).val();
		const projectId = $('#select-item-project').val();
		const companyId = $('#select-item-company').val();
		await fetchParties(projectId, selectedEnvironment);

		$('#outbound-endpoint-data-table').find('tbody tr').each(function (index) {
			let $selectParty = $('#select-party-' + index);

			$selectParty.empty();
			$selectParty.wrap('<div class="position-relative"></div>').select2({
				data: partiesOptionsGlobal,
				width: '100%',
				placeholder: '-- Please Select --',
				dropdownParent: $selectParty.parent()
			});

			$selectParty.val('').trigger('change');
		});

		if (projectId && selectedEnvironment) {
			const findProject = projectOptionGlobal.find(item => item.value === projectId);
			const findEnvironment = environmentOptionGlobal.find(item => item.value === selectedEnvironment);
			const findCompany = companyOptionGlobal.find(item => item._id === companyId);
			let isSystemCompany = findCompany.isSystemCompany;
			let companyPrefix = null;
			let projectPrefix = null;
			let envPrefix = null;

			if (!isSystemCompany) {
				companyPrefix = findCompany?.isUrlPerfix
					? null
					: findCompany?.code || null;

				projectPrefix = findProject?.value === ' '
					? findCompany?.isDisableDefaultProjectPrefix
						? null
						: findCompany?.defaultProjectPrefix || null
					: findProject?.isUrlPerfix
						? null
						: findProject?.code || null;

				envPrefix = findEnvironment?.isUrlPerfix
					? null
					: findEnvironment?.ddepApiPrefix?.replace(/^\/+/, '') || null;

			} else {
				const globalSettingsData = reponseGloabalSetting?.data[0] || {}
				let disableDefaultProjectPrefix = globalSettingsData?.disableDefaultProjectPrefix == "off" ? 1 : 0;

				projectPrefix = findProject?.value === ' '
					? disableDefaultProjectPrefix
						? globalSettingsData?.defaultProjectPrefix || null
						: null
					: findProject?.isUrlPerfix
						? null
						: findProject?.code || null;

				envPrefix = findEnvironment?.isUrlPerfix
					? null
					: findEnvironment?.ddepApiPrefix?.replace(/^\/+/, '') || null;
			}
			const parts = [companyPrefix, projectPrefix, envPrefix].filter(Boolean);
			const urlPrefix = parts.join('/');
			$('#url-prefix').val(urlPrefix);
			const finalUrl = `${ddepApiPrefix.replace(/\/+$/, '')}${urlPrefix ? '/' + urlPrefix : ''}`;

			$('#ddep-api-prefix').text(finalUrl);
		}
	}
	$('#select-item-environment').select2('close');
});

$('body').on('click', '#item-project-edit-button', function () {
	const projectSelectedOption = $('#select-item-project').find('option:selected');
	const projectSelectedValue = projectSelectedOption.val();
	if (projectSelectedValue) {
		let find = projectListOptions.find((item) => item._id == projectSelectedValue);
		if (find) editProject(find);
	}
});

$('body').on('select2:open', '#select-item-environment', function () {
	const dropdown = $(this).data('select2').dropdown.$search[0].parentElement;

	if (!$(dropdown).find('.add-new-item-btn').length) {
		$(dropdown).append(`
			<button style="width: 100%" type="button" class="btn btn-primary add-new-item-btn mt-1" onClick="createEnvironment()">Create Environment</button>
		`);
	}
});

async function createEnvironment() {
	try {
		isEnvironmentsPage = false;

		clearErrors();

		$('#environment-id').val('');

		const companyId = $('#select-item-company').val() || '';
		const projectId = $('#select-item-project').val() || '';

		if (!companyId) {
			console.warn('No company selected');
			Swal.fire({
				title: 'Warning!',
				text: 'Please select a company first',
				icon: 'warning',
				customClass: {
					confirmButton: 'btn btn-primary'
				},
				buttonsStyling: false,
				timer: 2000
			});
			return;
		}

		$('#select-environment-company').val(companyId);
		$('#select-environment-company').data('project_id', projectId)
		$('#select-environment-company').trigger('change');
		await new Promise(resolve => setTimeout(resolve, 100));

		if (companyId) {
			try {
				await getEnvironmentProjects(companyId, projectId, false);
			} catch (error) {
				console.error('Failed to load projects:', error);
			}
		}

		$('#environment-name').val('');
		$('#environment-api-prefix').val('');
		$('#environment-description').val('');
		$('#environment-sequence').val('');
		$('#is-environment-urlprefix').prop('checked', false);
		$('#is-environment-active').prop('checked', true);

		// Set modal UI text
		$('#environment-modal-label').text('Create Environment');
		$('#create-environment').text('Create Environment');

		// Close any open select2 dropdowns and show modal
		$('#select-item-environment').select2('close');
		$('#environment-create-modal-slide-in').modal('show');


	} catch (error) {
		console.error('Error in createEnvironment:', error);
		Swal.fire({
			title: 'Error!',
			text: 'Failed to initialize environment creation',
			icon: 'error',
			customClass: {
				confirmButton: 'btn btn-primary'
			},
			buttonsStyling: false,
			timer: 2000
		});
	}
}

$('body').on('click', '#item-environment-edit-button', function () {
	const environmentSelectedOption = $('#select-item-environment').find('option:selected');
	const environmentSelectedValue = environmentSelectedOption.val();
	if (environmentSelectedValue) {
		let find = environmentListOptions.find((item) => item._id == environmentSelectedValue);
		if (find) editEnvironmentItem(find);
	}
});

async function updateEnvironmentOptions() {
	const $selectedProject = $('#select-item-project').val();
	const selectCompany = $('#select-item-company').val();
	const $selectedEnvironment = $('#select-item-environment');
	const currentValue = $selectedEnvironment.val();
	await getEnvironments(selectCompany, $selectedProject, '', true);
	if (currentValue) {
		$selectedEnvironment.val(currentValue).trigger('change');
	}
}

function editEnvironmentItem(environmentData) {
	isEnvironmentsPage = false;
	clearFormFieldsEnvironment();
	environmentId = environmentData._id;
	if (environmentId) {
		$('#environment-id').val(environmentId);
		$('#environment-modal-label').text('Update Environment');
		$('#create-environment').text('Update Environment');
		editEnvironment(environmentId)
			.then(response => { })
			.catch(error => {
				Swal.fire({
					title: 'Error!',
					text: error,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			});
	}
	$('#environment-create-modal-slide-in').modal('show');
}

function getGeneralSettings(companyCode) {
	return new Promise((resolve, reject) => {
		$.ajax({
			type: "POST",
			url: "/settings/edit/general-settings",
			contentType: "application/json",
			data: JSON.stringify({ companyCode }),
			success: function (response) {
				resolve(response.data);
			},
			error: function (xhr, status, error) {
				console.error("Error while fetching general settings:", error);
				reject(error);
			}
		});
	});
}

function getProjects(companyId, projectId, clearProjectSelect = false) {
	return new Promise((resolve, reject) => {
		if (companyId) {
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({ 'display': 'block' });

			$.ajax({
				url: '/master/projects/all-company-project',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ companyId }),
				success: function (response) {
					if (response.status == 1) {
						const selectProject = document.getElementById('select-item-project');
						let projectList = [];

						selectProject.innerHTML = '<option value="">-- Please Select --</option>';

						const defaultOption = document.createElement('option');
						defaultOption.value = ' ';
						defaultOption.textContent = "Default";
						defaultOption.setAttribute('data-name', "Default");
						defaultOption.setAttribute('data-code', null);

						selectProject.appendChild(defaultOption);

						projectList.push({
							name: "Default",
							value: ' ',
						});

						projectListOptions = response.data;

						response.data.forEach(item => {
							const option = document.createElement('option');
							option.value = item._id;
							option.textContent = item.name;
							option.setAttribute('data-name', item.name);
							option.setAttribute('data-code', item.code);

							selectProject.appendChild(option);
							projectList.push({
								name: item.name,
								value: item._id,
								code: item.code,
								isUrlPerfix: item.isUrlPerfix,
							});
						});

						projectOptionGlobal = projectList;

						const selectedProjectValue = projectId || " ";

						if (!clearProjectSelect && selectedProjectValue) {
							selectProject.value = selectedProjectValue;
						} else if (clearProjectSelect) {
							selectProject.value = '';
						}

						resolve();
					} else {
						Swal.fire({
							title: 'Error!',
							text: response.message,
							icon: 'error',
							customClass: {
								confirmButton: 'btn btn-primary'
							},
							buttonsStyling: false,
							timer: 1200
						});

						reject(new Error(response.message));
					}

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });
				},
				error: function (xhr, status, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });

					Swal.fire({
						title: 'Error!',
						text: xhr?.responseJSON?.message,
						icon: 'error',
						customClass: {
							confirmButton: 'btn btn-primary'
						},
						buttonsStyling: false,
						timer: 1200
					});

					reject(new Error(xhr?.responseJSON?.message));
				}
			});
		} else {
			resolve();
		}
	});
}

function getEnvironments(companyId, projectId, environmentId, clearEnvironmentSelect = false) {
	return new Promise((resolve, reject) => {
		if (projectId || projectId == " ") {
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({ 'display': 'block' });

			$.ajax({
				url: '/master/environments/all-project-environment',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ companyId, projectId: projectId == " " ? null : projectId }),
				success: function (response) {
					if (response.status == 1) {
						const selectEnvironment = document.getElementById('select-item-environment');
						let environmentList = [];

						selectEnvironment.innerHTML = '<option value="">-- Please Select --</option>';

						response.data.forEach(item => {
							const option = document.createElement('option');
							option.value = item._id;
							option.textContent = item.name;
							option.setAttribute('data-name', item.name);

							selectEnvironment.appendChild(option);
							environmentList.push({
								name: item.name,
								value: item._id,
								ddepApiPrefix: item.ddepApiPrefix,
								isUrlPerfix: item.isUrlPerfix
							});
						});

						environmentOptionGlobal = environmentList;
						environmentListOptions = response.data;
						const companyId = $('#select-item-company').val();
						const findProject = projectOptionGlobal.find(item => item.value === projectId);
						const findCompany = companyOptionGlobal.find(item => item._id === companyId);

						if (findProject) {
							let isSystemCompany = findCompany.isSystemCompany;
							let companyPrefix = null;
							let projectPrefix = null;

							if (!isSystemCompany) {
								companyPrefix = findCompany?.isUrlPerfix
									? null
									: findCompany?.code || null;

								projectPrefix = findProject?.value === ' '
									? findCompany?.isDisableDefaultProjectPrefix
										? null
										: findCompany?.defaultProjectPrefix || null
									: findProject?.isUrlPerfix
										? null
										: findProject?.code || null;
							} else {
								const globalSettingsData = reponseGloabalSetting?.data[0] || {}
								let disableDefaultProjectPrefix = globalSettingsData?.disableDefaultProjectPrefix == "off" ? 1 : 0;

								projectPrefix = findProject?.value === ' '
									? disableDefaultProjectPrefix
										? globalSettingsData?.defaultProjectPrefix || null
										: null
									: findProject?.isUrlPerfix
										? null
										: findProject?.code || null;
							}
							const parts = [companyPrefix, projectPrefix].filter(Boolean);
							const urlPrefix = parts.join("/");
							$('#url-prefix').val(urlPrefix);
							const ddepApiPrefixUrl = urlPrefix ? `${ddepApiPrefix}/${urlPrefix}` : ddepApiPrefix;
							$('#ddep-api-prefix').text(ddepApiPrefixUrl);
						}

						const selectedEnvironmentValue = environmentId || " ";

						if (selectedEnvironmentValue && !clearEnvironmentSelect) {
							const findEnvironment = environmentOptionGlobal.find(
								item => item.value === selectedEnvironmentValue
							);

							if (findEnvironment) {
								let isSystemCompany = findCompany.isSystemCompany;
								let companyPrefix = null;
								let projectPrefix = null;
								let envPrefix = null;

								if (!isSystemCompany) {
									companyPrefix = findCompany?.isUrlPerfix
										? null
										: findCompany?.code || null;

									projectPrefix = findProject?.value === ' '
										? findCompany?.isDisableDefaultProjectPrefix
											? null
											: findCompany?.defaultProjectPrefix || null
										: findProject?.isUrlPerfix
											? null
											: findProject?.code || null;

									envPrefix = findEnvironment?.isUrlPerfix
										? null
										: findEnvironment?.ddepApiPrefix?.replace(/^\/+/, '') || null;
								} else {
									const globalSettingsData = reponseGloabalSetting?.data[0] || {}
									let disableDefaultProjectPrefix = globalSettingsData?.disableDefaultProjectPrefix == "off" ? 1 : 0;

									projectPrefix = findProject?.value === ' '
										? disableDefaultProjectPrefix
											? globalSettingsData?.defaultProjectPrefix || null
											: null
										: findProject?.isUrlPerfix
											? null
											: findProject?.code || null;

									envPrefix = findEnvironment?.isUrlPerfix
										? null
										: findEnvironment?.ddepApiPrefix?.replace(/^\/+/, '') || null;
								}

								const parts = [companyPrefix, projectPrefix, envPrefix].filter(Boolean);
								const urlPrefix = parts.join("/");
								$('#url-prefix').val(urlPrefix);
								const ddepApiPrefixUrl = urlPrefix ? `${ddepApiPrefix}/${urlPrefix}` : ddepApiPrefix;
								$('#ddep-api-prefix').text(ddepApiPrefixUrl);
							}

							selectEnvironment.value = selectedEnvironmentValue;
						} else if (clearEnvironmentSelect) {
							selectEnvironment.value = '';
						}

						resolve();
					} else {
						Swal.fire({
							title: 'Error!',
							text: response.message,
							icon: 'error',
							customClass: {
								confirmButton: 'btn btn-primary'
							},
							buttonsStyling: false,
							timer: 1200
						});

						reject(new Error(response.message));
					}

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });
				},
				error: function (xhr, status, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });

					Swal.fire({
						title: 'Error!',
						text: xhr?.responseJSON?.message,
						icon: 'error',
						customClass: {
							confirmButton: 'btn btn-primary'
						},
						buttonsStyling: false,
						timer: 1200
					});

					reject(new Error(xhr?.responseJSON?.message));
				}
			});
		} else {
			resolve();
		}
	});
}

if (typeof horizontalWizard !== undefined && horizontalWizard !== null) {
	const numberedStepper = new Stepper(horizontalWizard),
		$form = $(horizontalWizard).find('form');
	$.validator.addMethod(
		'regex',
		function (value, element, regexp) {
			const re = new RegExp(regexp);
			return this.optional(element) || re.test(value);
		},
		`DDEP API is not valid (must start with a '/' and must contain any letter, capitalize letter, number, dash or underscore)`
	);
	$.validator.addMethod(
		'pattern',
		function (value, element, regexp) {
			if ((value.match(/\//g) || []).length > regexp) {
				return false;
			} else {
				return true;
			}
		},
		`DDEP API is only allow 10 '/'`
	);
	$form.each(function () {
		const $this = $(this);
		$this.validate({
			onkeyup: function (element) {
				$(element).valid();
			},
			onfocusout: function (element) {
				$(element).valid();
			},
			rules: {
				'item-code': {
					required: true,
				},
				'item-name': {
					required: true,
				},
				'select-item-company': {
					required: true
				},
				'select-item-project': {
					required: true
				},
				'select-item-environment': {
					required: true
				},
				'platform': {
					required: true
				},
				'platform-api-type': {
					required: true
				},
				'ddep-api-endpoint': {
					required: true,
					maxlength: 100,
					regex: /^(\/)[a-zA-Z0-9-_\/]+$/,
					pattern: 10,
					remote: {
						url: '/projects/inbounds/check-ddep-endpoint-exist',
						type: 'POST',
						data: {
							ddepApiEndpoint: function () {
								return $('#ddep-api-endpoint').val();
							},
							urlPrefix: function () {
								return $('#url-prefix').val();
							},
							itemId: function () {
								return $('#item-id').val();
							}
						},
						dataFilter: function (response) {
							const json = JSON.parse(response);

							if (json.status === 1) {
								return true;
							} else {
								return '\"' + json.message + '\"';
							}
						}
					}
				},
				'user-api': {
					required: true
				},
				'ftp-server-link': {
					required: true
				},
				'port': {
					required: true
				},
				'login-name': {
					required: true
				},
				'password': {
					required: true
				},
				'folder': {
					required: true
				},
				'flow': {
					required: true
				},
				'flow-api-type': {
					required: true
				},
				'select-outbound-mime-type': {
					required: true
				},
				'one_time_occurrence_inbound_date': {
					required: '#one_time_occurrence_inbound_date:visible'
				},
				'one_time_occurrence_inbound_time': {
					required: '#one_time_occurrence_inbound_time:visible'
				},
				'one_time_occurrence_outbound_date': {
					required: '#one_time_occurrence_outbound_date:visible'
				},
				'one_time_occurrence_outbound_time': {
					required: '#one_time_occurrence_outbound_time:visible'
				},
				'daily_frequency_once_time_inbound': {
					required: '#daily_frequency_once_time_inbound:visible'
				},
				'daily_frequency_once_time_outbound': {
					required: '#daily_frequency_once_time_outbound:visible'
				},
				'duration_inbound_start_date': {
					required: '#duration_inbound_start_date:visible'
				},
				'duration_outbound_start_date': {
					required: '#duration_outbound_start_date:visible'
				},
				'daily_frequency_every_time_count_start_inbound': {
					required: '#daily_frequency_every_time_count_start_inbound:visible'
				},
				'daily_frequency_every_time_count_start_outbound': {
					required: '#daily_frequency_every_time_count_start_outbound:visible'
				},
				'daily_frequency_every_time_count_end_inbound': {
					required: '#daily_frequency_every_time_count_end_inbound:visible'
				},
				'daily_frequency_every_time_count_end_outbound': {
					required: '#daily_frequency_every_time_count_end_outbound:visible'
				},
				'duration_inbound_end_date': {
					required: '#duration_inbound_end_date:visible'
				},
				'duration_outbound_end_date': {
					required: '#duration_outbound_end_date:visible'
				}
			},
			messages: {
				'ddep-api-endpoint': {
					required: 'Please enter the DDEP API endpoint',
					maxlength: 'Maximum 100 characters allowed',
					remote: 'This endpoint already exists'
				}
			}
		});
	});

	$(horizontalWizard)
		.find('.btn-next')
		.each(function (index) {
			$(this).on('click', function (event) {
				event.preventDefault();

				const isValid = $(this).parent().siblings('form').valid();
				const itemId = $('#item-id').val();

				if (isValid) {
					if (index === 0) {
						$('#item-step').find('.btn-next').prop('disabled', true);

						$('.overlay, body').removeClass('loaded');
						$('.overlay').css({ 'display': 'block' });

						const apiUrl = (!itemId) ? '/projects/create' : '/projects/update/' + itemId;
						const method = (!itemId) ? 'POST' : 'PUT';

						let companyId = $('#select-item-company').val();
						let projectId = $('#select-item-project').val();
						let environmentId = $('#select-item-environment').val();
						urlPrefix = "";
						const findProject = projectOptionGlobal.find((item) => item.value === projectId);
						const findEnvironment = environmentOptionGlobal.find((item) => item.value === environmentId);
						const findCompany = companyOptionGlobal.find((item) => item._id === companyId);
						let isSystemCompany = findCompany.isSystemCompany;
						let companyPrefix = null;
						let projectPrefix = null;
						let envPrefix = null;

						if (!isSystemCompany) {
							companyPrefix = findCompany?.isUrlPerfix
								? null
								: findCompany?.code || null;

							projectPrefix = findProject?.value === ' '
								? findCompany?.isDisableDefaultProjectPrefix
									? null
									: findCompany?.defaultProjectPrefix || null
								: findProject?.isUrlPerfix
									? null
									: findProject?.code || null;

							envPrefix = findEnvironment?.isUrlPerfix
								? null
								: findEnvironment?.ddepApiPrefix?.replace(/^\/+/, '') || null;

						} else {
							const globalSettingsData = reponseGloabalSetting?.data[0] || {}
							let disableDefaultProjectPrefix = globalSettingsData?.disableDefaultProjectPrefix == "off" ? 1 : 0;

							projectPrefix = findProject?.value === ' '
								? disableDefaultProjectPrefix
									? globalSettingsData?.defaultProjectPrefix || null
									: null
								: findProject?.isUrlPerfix
									? null
									: findProject?.code || null;

							envPrefix = findEnvironment?.isUrlPerfix
								? null
								: findEnvironment?.ddepApiPrefix?.replace(/^\/+/, '') || null;
						}

						const parts = [companyPrefix, projectPrefix, envPrefix].filter(Boolean);
						urlPrefix = parts.join("/");
						$('#url-prefix').val(urlPrefix);
						const ddepApiPrefixUrl = urlPrefix ? `${ddepApiPrefix}/${urlPrefix}` : ddepApiPrefix;
						$('#ddep-api-prefix').text(ddepApiPrefixUrl);

						$.ajax({
							url: apiUrl,
							method: method,
							contentType: 'application/json',
							data: JSON.stringify({
								itemCode: $('#item-code').val(),
								itemName: $('#item-name').val(),
								itemDescription: $('#item-description').val(),
								companyId: companyId,
								projectId: projectId == " " ? null : projectId,
								environmentId: environmentId,
								companyCode: itemCompanyCode
							}),
							success: function (response) {
								if (response.status === 1) {
									if (!itemId) {
										$('#item-id').val(response.id);
										logsItemId = response.id;
										itemCompanyCode = response.companyCode;
									}

									Swal.fire({
										title: 'Success!',
										text: response.message,
										icon: 'success',
										customClass: {
											confirmButton: 'btn btn-primary'
										},
										buttonsStyling: false,
										timer: 1200
									});

									numberedStepper.to(2);
								} else {
									Swal.fire({
										title: 'Error!',
										text: response.message,
										icon: 'error',
										customClass: {
											confirmButton: 'btn btn-primary'
										},
										buttonsStyling: false,
										timer: 1200
									});
								}

								$('.overlay, body').addClass('loaded');
								$('.overlay').css({ 'display': 'none' });
								$('#item-step').find('.btn-next').prop('disabled', false);
							},
							error: function (xhr, status, error) {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({ 'display': 'none' });
								$('#item-step').find('.btn-next').prop('disabled', false);

								Swal.fire({
									title: 'Error!',
									text: xhr?.responseJSON?.message || 'An unexpected error occurred.',
									icon: 'error',
									customClass: {
										confirmButton: 'btn btn-primary'
									},
									buttonsStyling: false,
									timer: 1200
								});
							}
						});
					} else if (index === 1) {
						$('#inbound-step').find('.btn-prev').prop('disabled', true);
						$('#inbound-step').find('.btn-next').prop('disabled', true);

						$('.overlay, body').removeClass('loaded');
						$('.overlay').css({ 'display': 'block' });

						const inboundId = $('#item-inbound-id').val();
						const apiUrl = (!inboundId) ? '/projects/inbounds/create' : '/projects/inbounds/update/' + inboundId;
						const method = (!inboundId) ? 'POST' : 'PUT';

						const sync_type = $('input[name="platform"]:checked').val();
						const api_type = $('input[name="platform-api-type"]:checked').val();

						if (sync_type == 'API' && api_type == 'DDEP_API') {
							$('#inbound-shedule-setting-tab').hide();
							$('#outbound-shedule-setting-tab').hide();
							$('#inbound-ddep-api-selected').show();
							$('#outboud_max_post_file').hide();
							$('#collections_configure').show();
						}

						if (sync_type == 'API' && api_type == 'User_API') {
							$('#inbound-shedule-setting-tab').show();
							$('#outbound-shedule-setting-tab').hide();
							$('#inbound-ddep-api-selected').hide();
							$('#outboud_max_post_file').hide(); 0
							$('#collections_configure').show();
						}

						if (sync_type == 'FTP' || sync_type == 'SFTP') {
							$('#inbound-shedule-setting-tab').show();
							$('#outbound-shedule-setting-tab').show();
							$('#inbound-ddep-api-selected').hide();
							$('#outboud_max_post_file').show();
							$('#collections_configure').hide();
						}

						let apiKeyTable = [];

						$('#api-key-data-table').find('tbody tr').each(function (index) {
							let formDataObj = {};
							let $fieldset = $(this);

							formDataObj.status = $('input[name="api-key-status"]', $fieldset).is(':checked');
							formDataObj.type = $('input:text[name="type"]', $fieldset).val();
							formDataObj.key = $('input:text[name="key"]', $fieldset).val();
							formDataObj.description = $('input:text[name="description"]', $fieldset).val();
							formDataObj.expiryDate = $('input[type="date"][name="expiry-date"]', $fieldset).val() || null;

							// Check if the type is JWT_Bearer to add specific properties
							if ($('#select-ddep-api-auth-type').val() === 'JWT_Bearer') {
								formDataObj.jwtType = $('input:text[name="jwt-type"]', $fieldset).val();
								formDataObj.base64Encode = $('input:text[name="base64-encoded"]', $fieldset).val();
							}

							if (formDataObj.type && formDataObj.key) {
								apiKeyTable.push(formDataObj);
							}
						});

						let companyId = $('#select-item-company').val();
						let projectId = $('#select-item-project').val();
						let environmentId = $('#select-item-environment').val();
						urlPrefix = "";
						const findProject = projectOptionGlobal.find((item) => item.value === projectId);
						const findEnvironment = environmentOptionGlobal.find((item) => item.value === environmentId);
						const findCompany = companyOptionGlobal.find((item) => item._id === companyId);
						let isSystemCompany = findCompany.isSystemCompany;
						let companyPrefix = null;
						let projectPrefix = null;
						let envPrefix = null;

						if (!isSystemCompany) {
							companyPrefix = findCompany?.isUrlPerfix
								? null
								: findCompany?.code || null;

							projectPrefix = findProject?.value === ' '
								? findCompany?.isDisableDefaultProjectPrefix
									? null
									: findCompany?.defaultProjectPrefix || null
								: findProject?.isUrlPerfix
									? null
									: findProject?.code || null;

							envPrefix = findEnvironment?.isUrlPerfix
								? null
								: findEnvironment?.ddepApiPrefix?.replace(/^\/+/, '') || null;

						} else {
							const globalSettingsData = reponseGloabalSetting?.data[0] || {}
							let disableDefaultProjectPrefix = globalSettingsData?.disableDefaultProjectPrefix == "off" ? 1 : 0;

							projectPrefix = findProject?.value === ' '
								? disableDefaultProjectPrefix
									? globalSettingsData?.defaultProjectPrefix || null
									: null
								: findProject?.isUrlPerfix
									? null
									: findProject?.code || null;

							envPrefix = findEnvironment?.isUrlPerfix
								? null
								: findEnvironment?.ddepApiPrefix?.replace(/^\/+/, '') || null;
						}

						const parts = [companyPrefix, projectPrefix, envPrefix].filter(Boolean);
						urlPrefix = parts.join("/");
						$('#url-prefix').val(urlPrefix);
						$.ajax({
							url: apiUrl,
							method: method,
							contentType: 'application/json',
							data: JSON.stringify({
								itemId,
								urlPrefix: urlPrefix,
								platform: $('input[name="platform"]:checked').val(),
								platformApiType: $('input[name="platform-api-type"]:checked').val(),
								mimeType: $('#select-inbound-mime-type').val(),
								ddepApiEndpoint: $('#ddep-api-endpoint').val(),
								ddepApiAuthType: $('#select-ddep-api-auth-type').val(),
								ddepApiAuthorizationApiKeys: JSON.stringify(apiKeyTable),
								userApi: $('#user-api').val(),
								ftpServerLink: $('#ftp-server-link').val(),
								port: $('#port').val(),
								loginName: $('#login-name').val(),
								password: $('#password').val(),
								folder: $('#folder').val(),
								backupFolder: $('#backup-folder').val(),
								maxFileDownload: $('#max-file-download').val(),
								disabledInboundEmailFailuresNotice: $('#inbound-step').find('#disabledInboundEmailFailuresNotice').prop('checked') ? 'on' : 'off',
								enableLog: $('#inbound-step').find('#inboundEnableLogs').prop('checked') ? 'on' : 'off',
								enableEmail: $('#inbound-step').find('#inboundEnableEmail').prop('checked') ? 'on' : 'off',
								email_endpoint_url: $('#inbound-step').find("#inboundEndpointURL").prop("checked") || false,
								email_log_url: $('#inbound-step').find("#inboundLogURL").prop("checked") || false,
								email_request_header: $('#inbound-step').find("#inboundRequestHeader").prop("checked") || false,
								email_query_params: $('#inbound-step').find("#inboundQueryParams").prop("checked") || false,
								email_body: $('#inbound-step').find("#inboundBody").prop("checked") || false,
								email_body_html: $('#inbound-step').find("#inboundBodyhtml").prop("checked") || false,
								email_validation_message: $('#inbound-step').find("#inboundValidationMessage").prop("checked") || false,
								email_logs: $('#inbound-step').find("#inboundLogs").prop("checked") || false,
								is_active: $('#inbound-step').find('#is_active_inbound').prop('checked') ? 'Active' : 'InActive',
								companyCode: itemCompanyCode
							}),
							success: function (response) {
								if (response.status === 1) {
									if (!inboundId) {
										$('#item-inbound-id').val(response.id);
									}

									Swal.fire({
										title: 'Success!',
										text: response.message,
										icon: 'success',
										customClass: {
											confirmButton: 'btn btn-primary'
										},
										buttonsStyling: false,
										timer: 1200
									});

									numberedStepper.to(3);
								} else {
									Swal.fire({
										title: 'Error!',
										text: response.message,
										icon: 'error',
										customClass: {
											confirmButton: 'btn btn-primary'
										},
										buttonsStyling: false,
										timer: 1200
									});
								}

								$('.overlay, body').addClass('loaded');
								$('.overlay').css({ 'display': 'none' });
								$('#inbound-step').find('.btn-prev').prop('disabled', false);
								$('#inbound-step').find('.btn-next').prop('disabled', false);
							},
							error: function (xhr, status, error) {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({ 'display': 'none' });
								$('#inbound-step').find('.btn-prev').prop('disabled', false);
								$('#inbound-step').find('.btn-next').prop('disabled', false);

								Swal.fire({
									title: 'Error!',
									text: xhr?.responseJSON?.message || 'An unexpected error occurred.',
									icon: 'error',
									customClass: {
										confirmButton: 'btn btn-primary'
									},
									buttonsStyling: false,
									timer: 1200
								});
							}
						});
					} else if (index === 2) {
						$('#outbound-step').find('.btn-prev').prop('disabled', true);
						$('#outbound-step').find('.btn-next').prop('disabled', true);

						$('.overlay, body').removeClass('loaded');
						$('.overlay').css({ 'display': 'block' });

						const outboundId = $('#item-outbound-id').val();
						const apiUrl = (!outboundId) ? '/projects/outbounds/create' : '/projects/outbounds/update/' + outboundId;
						const method = (!outboundId) ? 'POST' : 'PUT';

						let endPointTable = [];
						let globalHeadersTable = [];

						$('#outbound-endpoint-data-table').find('tbody tr').each(function (index) {
							const rowId = $(this).attr('data-id');
							let formDataObj = {};
							let $fieldset = $(this);

							let inboundValue = $('select:eq(1) option:selected', $fieldset).val();
							if (inboundValue == ' ') {
								inboundValue = '';
							}

							let outboundValue = $('select:eq(2) option:selected', $fieldset).val();
							if (outboundValue == ' ') {
								outboundValue = '';
							}

							let inboundMapping = inboundValue ? inboundValue.split('-')[0] : '';
							let inboundMappingVersion = inboundValue ? inboundValue.split('-')[1] : '';

							let outboundMapping = outboundValue ? outboundValue.split('-')[0] : '';
							let outboundMappingVersion = outboundValue ? outboundValue.split('-')[1] : '';

							formDataObj.status = $('input[name="outbound-endpoint-status"]', $fieldset).is(':checked');
							formDataObj.party = $('select:eq(0) option:selected', $fieldset).val();
							formDataObj.endpoint = $('input:text:eq(0)', $fieldset).val();
							formDataObj.inboundMappingVersion = inboundMappingVersion;
							formDataObj.outboundMappingVersion = outboundMappingVersion;
							formDataObj.inboundMapping = inboundMapping;
							formDataObj.outboundMapping = outboundMapping;
							formDataObj.default_response = $('input[name="outbound-default-response-status"]', $fieldset).is(':checked');
							formDataObj.triggerRules = triggerRulesJson[`row-${rowId}`];
							if (!specifyHeaderJson[`row-${rowId}`]) {
								specifyHeaderJson[`row-${rowId}`] = {
									headers: [],
									globalVariablesBeforeTrigger: [],
									globalVariablesAfterResponse: [],
									actionsArray: [],
									templateInbound: '',
									templateOutbound: '',
									logDescription: '',
									beforeLogDescription: '',
									notificationEmailTitle: '',
									notificationEmail: '',
									disableInboundEmail: false,
									disableOutboundEmail: false,
									request_method: 'DEFAULT'
								};
							}
							formDataObj.specifyHeaders = specifyHeaderJson[`row-${rowId}`];

							if (formDataObj.party && formDataObj.endpoint) {
								endPointTable.push(formDataObj);
							}
						});

						$('#outbound-global-headers-table').find('tbody tr').each(function (index) {
							let formDataObj = {};
							let $fieldset = $(this);

							formDataObj.status = $('input[name="outbound-global-headers-status"]', $fieldset).is(':checked');
							formDataObj.key = $('input:text:eq(0)', $fieldset).val();
							formDataObj.value = $('input:text:eq(1)', $fieldset).val();
							formDataObj.mask = $('input[name="outbound-global-headers-mask"]', $fieldset).is(':checked');
							formDataObj.description = $('input:text:eq(2)', $fieldset).val();

							if (formDataObj.key && formDataObj.value) {
								globalHeadersTable.push(formDataObj);
							}
						});

						let defaultInboundMapping = $('#select-inbound-default-mapping').val();
						let defaultOutboundMapping = $('#select-outbound-default-mapping').val();
						let defaultInbound = '';
						let defaultOutbound = '';
						let defaultInboundMappingVersion = '';
						let defaultOutboundMappingVersion = '';

						if (defaultInboundMapping == ' ') {
							defaultInboundMapping = null;
						}

						if (defaultOutboundMapping == ' ') {
							defaultOutboundMapping = null;
						}

						defaultInbound = defaultInboundMapping ? defaultInboundMapping.split('-')[0] : '';
						defaultInboundMappingVersion = defaultInboundMapping ? defaultInboundMapping.split('-')[1] : '';

						defaultOutbound = defaultOutboundMapping ? defaultOutboundMapping.split('-')[0] : '';
						defaultOutboundMappingVersion = defaultOutboundMapping ? defaultOutboundMapping.split('-')[1] : '';

						var max_file_post = $('#max_file_post').val();

						$.ajax({
							url: apiUrl,
							method: method,
							contentType: 'application/json',
							data: JSON.stringify({
								itemId,
								flow: $('input[name="flow"]:checked').val(),
								flowType: $('input[name="flow-api-type"]:checked').val(),
								mimeType: $('#select-outbound-mime-type').val(),
								maxFileDownload: max_file_post,
								defaultInboundMapping: defaultInbound,
								defaultOutboundMapping: defaultOutbound,
								defaultInboundMappingVersion: defaultInboundMappingVersion,
								defaultOutboundMappingVersion: defaultOutboundMappingVersion,
								endpoints: endPointTable,
								globalHeaders: globalHeadersTable,
								companyCode: itemCompanyCode,
								disabledOutboundResponseFailuresNotice: $('#outbound-step').find('#disabledOutboundResponseFailuresNotice').prop('checked') ? 'on' : 'off',
								disabledOutboundEmailFailuresNotice: $('#outbound-step').find('#disabledOutboundEmailFailuresNotice').prop('checked') ? 'on' : 'off',
								enableLog: $('#outbound-step').find('#outboundEnableLogs').prop('checked') ? 'on' : 'off',
								enableEmail: $('#outbound-step').find('#outboundEnableEmail').prop('checked') ? 'on' : 'off',
								email_endpoint_url: $('#outbound-step').find("#outboundEndpointURL").prop("checked") || false,
								email_log_url: $('#outbound-step').find("#outboundLogURL").prop("checked") || false,
								email_request_header: $('#outbound-step').find("#outboundRequestHeader").prop("checked") || false,
								email_transformed_header: $('#outbound-step').find("#outboundRequestTransformedHeader").prop("checked") || false,
								email_query_params: $('#outbound-step').find("#outboundQueryParams").prop("checked") || false,
								email_body: $('#outbound-step').find("#outboundBody").prop("checked") || false,
								email_body_html: $('#outbound-step').find("#outboundBodyhtml").prop("checked") || false,
								email_transformed_body: $('#outbound-step').find("#outboundTransformedBody").prop("checked") || false,
								email_transformed_body_html: $('#outbound-step').find("#outboundTransformedBodyhtml").prop("checked") || false,
								email_request_endpoint_url_information: $('#outbound-step').find("#outboundRequestToEndPointUrl").prop("checked") || false,
								email_response: $('#outbound-step').find("#outboundResponse").prop("checked") || false,
								email_response_html: $('#outbound-step').find("#outboundResponsehtml").prop("checked") || false,
								email_transformed_response: $('#outbound-step').find("#outboundTransformedResponse").prop("checked") || false,
								email_transformed_response_html: $('#outbound-step').find("#outboundTransformedResponsehtml").prop("checked") || false,
								email_validation_message: $('#outbound-step').find("#outboundValidationMessage").prop("checked") || false,
								email_logs: $('#outbound-step').find("#outboundLogs").prop("checked") || false,
								is_active: $('#outbound-step').find('#is_active_outbound').prop('checked') ? 'Active' : 'InActive',
							}),
							success: function (response) {
								if (response.status === 1) {
									if (!outboundId) {
										$('#item-outbound-id').val(response.id);
									}

									Swal.fire({
										title: 'Success!',
										text: response.message,
										icon: 'success',
										customClass: {
											confirmButton: 'btn btn-primary'
										},
										buttonsStyling: false,
										timer: 1200
									});

									numberedStepper.to(4);
								} else {
									Swal.fire({
										title: 'Error!',
										text: response.message,
										icon: 'error',
										customClass: {
											confirmButton: 'btn btn-primary'
										},
										buttonsStyling: false,
										timer: 1200
									});
								}

								$('.overlay, body').addClass('loaded');
								$('.overlay').css({ 'display': 'none' });
								$('#outbound-step').find('.btn-prev').prop('disabled', false);
								$('#outbound-step').find('.btn-next').prop('disabled', false);
							},
							error: function (xhr, status, error) {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({ 'display': 'none' });
								$('#outbound-step').find('.btn-prev').prop('disabled', false);
								$('#outbound-step').find('.btn-next').prop('disabled', false);

								Swal.fire({
									title: 'Error!',
									text: xhr?.responseJSON?.message || 'An unexpected error occurred.',
									icon: 'error',
									customClass: {
										confirmButton: 'btn btn-primary'
									},
									buttonsStyling: false,
									timer: 1200
								});
							}
						});
					} else if (index === 3) {
						$('#outbound-step').find('.btn-prev').prop('disabled', true);
						$('#outbound-step').find('.btn-next').prop('disabled', true);

						$('.overlay, body').removeClass('loaded');
						$('.overlay').css({ 'display': 'block' });

						const scheduleSettingId = $('#schedule_setting_id').val();
						const apiUrl = (!scheduleSettingId) ? '/projects/schedules/create' : '/projects/schedules/update/' + scheduleSettingId;
						const method = (!scheduleSettingId) ? 'POST' : 'PUT';

						const Schedule_configure_inbound = $('input[name="s_configure_inbound"]:checked').val();
						const schedule_type_inbound = $('input[name="schedule_type_inbound"]:checked').val();
						const day_frequency_inbound_count = $('#day_frequency_inbound_count').val();
						const weekly_frequency_inbound_count = $('#weekly_frequency_inbound_count').val();
						const monthly_frequency_day_inbound = $('#monthly_frequency_day_inbound').val();
						const monthly_frequency_day_inbound_count = $('#monthly_frequency_day_inbound_count').val();
						const monthly_frequency_the_inbound_count = $('#monthly_frequency_the_inbound_count').val();
						const daily_frequency_type_inbound = $('input[name=daily_frequency_type_inbound]:checked').val();
						const daily_frequency_once_time_inbound = $('#daily_frequency_once_time_inbound').val();
						const daily_frequency_every_time_unit_inbound = $('#daily_frequency_every_time_unit_inbound').val();
						const daily_frequency_every_time_count_inbound = $('#daily_frequency_every_time_count_inbound').val();
						const daily_frequency_every_time_count_start_inbound = $('#daily_frequency_every_time_count_start_inbound').val();
						const daily_frequency_every_time_count_end_inbound = $('#daily_frequency_every_time_count_end_inbound').val();
						const duration_inbound_end_date = $('#duration_inbound_end_date').val();
						const duration_inbound_start_date = $('#duration_inbound_start_date').val();
						const duration_inbound_is_end_date = $('input[name="duration_inbound_is_end_date"]:checked').val();
						const occurs_inbound = $('#occurs_time_inbound').val();
						const next_date_inbound_start = new Date($("#duration_inbound_start_date").val());
						const Schedule_configure_outbound = $('input[name="s_configure_outbound"]:checked').val();
						const schedule_type_outbound = $('input[name="schedule_type_outbound"]:checked').val();
						const day_frequency_outbound_count = $('#day_frequency_outbound_count').val();
						const weekly_frequency_outbound_count = $('#weekly_frequency_outbound_count').val();
						const monthly_frequency_day_outbound = $('#monthly_frequency_day_outbound').val();
						const monthly_frequency_day_outbound_count = $('#monthly_frequency_day_outbound_count').val();
						const monthly_frequency_the_outbound_count = $('#monthly_frequency_the_outbound_count').val();
						const daily_frequency_type_outbound = $('input[name=daily_frequency_type_outbound]:checked').val();
						const daily_frequency_once_time_outbound = $('#daily_frequency_once_time_outbound').val();
						const daily_frequency_every_time_unit_outbound = $('#daily_frequency_every_time_unit_outbound').val();
						const daily_frequency_every_time_count_outbound = $('#daily_frequency_every_time_count_outbound').val();
						const daily_frequency_every_time_count_end_outbound = $('#daily_frequency_every_time_count_end_outbound').val();
						const daily_frequency_every_time_count_start_outbound = $('#daily_frequency_every_time_count_start_outbound').val();
						const duration_outbound_end_date = $('#duration_outbound_end_date').val();
						const duration_outbound_start_date = $('#duration_outbound_start_date').val();
						const duration_outbound_is_end_date = $('input[name="duration_outbound_is_end_date"]:checked').val();
						const occurs_outbound = $('#occurs_time_outbound').val();
						const next_date_outbound_start = new Date($('#duration_outbound_start_date').val());
						const enableLog = $('#schedule-step').find('#ScheduleEnableLogs').prop('checked') ? 'on' : 'off';

						let one_time_occurrence_inbound_date = '';
						let one_time_occurrence_inbound_time = '';
						let monthly_field_setting_inbound = [];
						let occurs_weekly_fields_inbound = [];
						let one_time_occurrence_outbound_date = '';
						let one_time_occurrence_outbound_time = '';
						let monthly_field_setting_outbound = [];
						let occurs_weekly_fields_outbound = [];

						if (schedule_type_inbound == 'OneTime') {
							one_time_occurrence_inbound_date = $('#one_time_occurrence_inbound_date').val();
							one_time_occurrence_inbound_time = $('#one_time_occurrence_inbound_time').val();
						}

						if (occurs_inbound == 'daily') {
						} else if (occurs_inbound == 'monthly') {
							const inbound_monthly_day = $('input[name=inbound_monthly_day]:checked').val();

							if (inbound_monthly_day == 'day') {
								let temp_obj = {};
								temp_obj['inbound_monthly_day'] = 'day';
								monthly_field_setting_inbound.push(temp_obj);
							} else {
								let temp_obj = {};
								const the_day_of = $('#the_day_of').val();
								const the_days = $('#the_days').val();
								temp_obj['inbound_monthly_day'] = 'the';
								temp_obj['the_day_of'] = the_day_of;
								temp_obj['the_days'] = the_days;
								monthly_field_setting_inbound.push(temp_obj);
							}
						} else if (occurs_inbound == 'weekly') {
							$('input[name=occurs_weekly_fields_inbound]:checked').each(function () {
								const tmp_week_obj = {}
								tmp_week_obj['day'] = $(this).val();
								occurs_weekly_fields_inbound.push(tmp_week_obj);
							});
						}

						next_date_inbound_start.setSeconds(0);
						next_date_inbound_start.setMilliseconds(0);
						const next_date_inbound_string = next_date_inbound_start.toUTCString();
						let next_date_inbound = parseInt(next_date_inbound_start.getTime() + (next_date_inbound_start.getTimezoneOffset() * 60 * 1000));

						if (daily_frequency_type_inbound == 'Occurs Once At') {
							const inbound_parts = daily_frequency_once_time_inbound.split(':');
							const result_inbound = milliseconds(inbound_parts[0], inbound_parts[1], 0);
							next_date_inbound = parseInt(next_date_inbound + result_inbound);
						} else {
							const inbound_parts = daily_frequency_every_time_count_start_inbound.split(':');
							const result_inbound = milliseconds(inbound_parts[0], inbound_parts[1], 0);
							next_date_inbound = parseInt(next_date_inbound + result_inbound);
						}

						if (schedule_type_outbound == 'OneTime') {
							one_time_occurrence_outbound_date = $('#one_time_occurrence_outbound_date').val();
							one_time_occurrence_outbound_time = $('#one_time_occurrence_outbound_time').val();
						}

						if (occurs_outbound == 'daily') {
						} else if (occurs_outbound == 'monthly') {
							const outbound_monthly_day = $('input[name=outbound_monthly_day]:checked').val();
							if (outbound_monthly_day == 'day') {
								const temp_obj = {};
								temp_obj['outbound_monthly_day'] = 'day';
								monthly_field_setting_outbound.push(temp_obj);
							} else {
								const temp_obj = {};
								const the_day_of_outbound = $('#the_day_of_outbound').val();
								const the_days_outbound = $('#the_days_outbound').val();
								temp_obj['outbound_monthly_day'] = 'the';
								temp_obj['the_day_of'] = the_day_of_outbound;
								temp_obj['the_days'] = the_days_outbound;
								monthly_field_setting_outbound.push(temp_obj);
							}
						} else if (occurs_outbound == 'weekly') {
							$('input[name=occurs_weekly_fields_outbound]:checked').each(function () {
								const tmp_week_obj = {}
								tmp_week_obj['day'] = $(this).val();
								occurs_weekly_fields_outbound.push(tmp_week_obj);
							});
						}

						next_date_outbound_start.setSeconds(0);
						next_date_outbound_start.setMilliseconds(0);
						const next_date_outbound_string = next_date_outbound_start.toUTCString();
						let next_date_outbound = parseInt(next_date_outbound_start.getTime() + (next_date_outbound_start.getTimezoneOffset() * 60 * 1000));

						if (daily_frequency_type_outbound == 'Occurs Once At') {
							const outbound_parts = daily_frequency_once_time_outbound.split(':');
							const result_outbound = milliseconds(outbound_parts[0], outbound_parts[1], 0);
							next_date_outbound = parseInt(next_date_outbound + result_outbound);
						} else {
							const outbound_parts = daily_frequency_every_time_count_start_outbound.split(':');
							const result_outbound = milliseconds(outbound_parts[0], outbound_parts[1], 0);
							next_date_outbound = parseInt(next_date_outbound + result_outbound);
						}

						$.ajax({
							url: apiUrl,
							method: method,
							contentType: 'application/json',
							data: JSON.stringify({
								item_id: itemId,
								Schedule_configure_inbound: Schedule_configure_inbound,
								schedule_type_inbound: schedule_type_inbound,
								one_time_occurrence_inbound_date: one_time_occurrence_inbound_date,
								one_time_occurrence_inbound_time: one_time_occurrence_inbound_time,
								occurs_inbound: occurs_inbound,
								monthly_field_setting_inbound: monthly_field_setting_inbound,
								occurs_weekly_fields_inbound: occurs_weekly_fields_inbound,
								day_frequency_inbound_count: day_frequency_inbound_count,
								day_frequency_outbound_count: day_frequency_outbound_count,
								weekly_frequency_inbound_count: weekly_frequency_inbound_count,
								weekly_frequency_outbound_count: weekly_frequency_outbound_count,
								monthly_frequency_day_inbound: monthly_frequency_day_inbound,
								monthly_frequency_day_inbound_count: monthly_frequency_day_inbound_count,
								monthly_frequency_day_outbound: monthly_frequency_day_outbound,
								monthly_frequency_day_outbound_count: monthly_frequency_day_outbound_count,
								monthly_frequency_the_inbound_count: monthly_frequency_the_inbound_count,
								monthly_frequency_the_outbound_count: monthly_frequency_the_outbound_count,
								daily_frequency_type_inbound: daily_frequency_type_inbound,
								daily_frequency_type_outbound: daily_frequency_type_outbound,
								daily_frequency_once_time_inbound: daily_frequency_once_time_inbound,
								daily_frequency_once_time_outbound: daily_frequency_once_time_outbound,
								daily_frequency_every_time_unit_inbound: daily_frequency_every_time_unit_inbound,
								daily_frequency_every_time_unit_outbound: daily_frequency_every_time_unit_outbound,
								daily_frequency_every_time_count_inbound: daily_frequency_every_time_count_inbound,
								daily_frequency_every_time_count_outbound: daily_frequency_every_time_count_outbound,
								daily_frequency_every_time_count_start_inbound: daily_frequency_every_time_count_start_inbound,
								daily_frequency_every_time_count_end_inbound: daily_frequency_every_time_count_end_inbound,
								daily_frequency_every_time_count_end_outbound: daily_frequency_every_time_count_end_outbound,
								daily_frequency_every_time_count_start_outbound: daily_frequency_every_time_count_start_outbound,
								Schedule_configure_outbound: Schedule_configure_outbound,
								schedule_type_outbound: schedule_type_outbound,
								one_time_occurrence_outbound_date: one_time_occurrence_outbound_date,
								one_time_occurrence_outbound_time: one_time_occurrence_outbound_time,
								occurs_outbound: occurs_outbound,
								monthly_field_setting_outbound: monthly_field_setting_outbound,
								occurs_weekly_fields_outbound: occurs_weekly_fields_outbound,
								duration_inbound_start_date: duration_inbound_start_date,
								duration_inbound_is_end_date: duration_inbound_is_end_date,
								duration_inbound_end_date: duration_inbound_end_date,
								duration_outbound_start_date: duration_outbound_start_date,
								duration_outbound_is_end_date: duration_outbound_is_end_date,
								duration_outbound_end_date: duration_outbound_end_date,
								next_date_inbound: next_date_inbound,
								next_date_outbound: next_date_outbound,
								enableLog: enableLog,
								companyCode: itemCompanyCode
							}),
							success: function (response) {
								if (response.status === 1) {
									if (!scheduleSettingId) {
										$('#schedule_setting_id').val(response.id)
									}

									Swal.fire({
										title: 'Success!',
										text: response.message,
										icon: 'success',
										customClass: {
											confirmButton: 'btn btn-primary'
										},
										buttonsStyling: false,
										timer: 1200
									});

									numberedStepper.to(5);
								} else {
									Swal.fire({
										title: 'Error!',
										text: response.message,
										icon: 'error',
										customClass: {
											confirmButton: 'btn btn-primary'
										},
										buttonsStyling: false,
										timer: 1200
									});
								}

								$('.overlay, body').addClass('loaded');
								$('.overlay').css({ 'display': 'none' });
								$('#outbound-step').find('.btn-prev').prop('disabled', false);
								$('#outbound-step').find('.btn-next').prop('disabled', false);
							},
							error: function (xhr, status, error) {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({ 'display': 'none' });
								$('#outbound-step').find('.btn-prev').prop('disabled', false);
								$('#outbound-step').find('.btn-next').prop('disabled', false);

								Swal.fire({
									title: 'Error!',
									text: xhr?.responseJSON?.message || 'An unexpected error occurred.',
									icon: 'error',
									customClass: {
										confirmButton: 'btn btn-primary'
									},
									buttonsStyling: false,
									timer: 1200
								});
							}
						});
					} else if (index === 4) {
						numberedStepper.to(7);
					}
				}
			});
		});

	$(horizontalWizard)
		.find('.btn-prev')
		.on('click', function () {
			numberedStepper.previous();
		});

	$(horizontalWizard)
		.find('.btn-submit')
		.on('click', function () {
			const isValid = $(this).parent().siblings('form').valid();
			if (isValid) {
				Swal.fire({
					title: 'Success!',
					text: 'Submitted..!!',
					icon: 'success',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
				if (urlPath === "/logs") {
					window.location.href = '/logs';
				} else {
					window.location.href = '/projects/project-list';
				}

			}
		});
}

$('input[name=s_configure_inbound]').on('change', function () {
	if ($(this).val() == 'click_by_user') {
		$('div.relation-schedule-open').slideUp('slow');
	} else {
		$('div.relation-schedule-open').slideDown('slow');
	}
});

$('input[name=s_configure_outbound]').on('change', function () {
	if ($(this).val() == 'click_by_user') {
		$('div.relation-outbound-schedule-open').slideUp('slow');
	} else {
		$('div.relation-outbound-schedule-open').slideDown('slow');
	}
});

$('#occurs_time_inbound').on('change', function () {
	if ($(this).val() == 'daily') {
		$('#weekly_fields').slideUp('slow');
		$('#monthly_fields').slideUp('slow');
		$('#selectOccursMonthIn').hide();
		$('#selectOccursWeekIn').hide();
		$('#selectOccursDayIn').show();
	}

	if ($(this).val() == 'weekly') {
		$('#monthly_fields').slideUp('slow');
		$('#weekly_fields').slideDown('slow');
		$('#selectOccursMonthIn').hide();
		$('#selectOccursWeekIn').show();
		$('#selectOccursDayIn').hide();
	}

	if ($(this).val() == 'monthly') {
		$('#weekly_fields').slideUp('slow');
		$('#monthly_fields').slideDown('slow');
		$('#selectOccursMonthIn').show();
		$('#selectOccursWeekIn').hide();
		$('#selectOccursDayIn').hide();
	}
});

$('#occurs_time_outbound').on('change', function () {
	if ($(this).val() == 'daily') {
		$('#weekly_fields_outbound').slideUp('slow');
		$('#monthly_fields_outbound').slideUp('slow');
		$('#selectOccursMonthInOutbound').hide();
		$('#selectOccursWeekInOutbound').hide();
		$('#selectOccursDayInOutbound').show();
	}

	if ($(this).val() == 'weekly') {
		$('#monthly_fields_outbound').slideUp('slow');
		$('#weekly_fields_outbound').slideDown('slow');
		$('#selectOccursMonthInOutbound').hide();
		$('#selectOccursWeekInOutbound').show();
		$('#selectOccursDayInOutbound').hide();
	}

	if ($(this).val() == 'monthly') {
		$('#weekly_fields_outbound').slideUp('slow');
		$('#monthly_fields_outbound').slideDown('slow');
		$('#selectOccursMonthInOutbound').show();
		$('#selectOccursWeekInOutbound').hide();
		$('#selectOccursDayInOutbound').hide();
	}
});

$('input[name=inbound_monthly_day]').on('change', function () {
	if ($(this).val() == 'day') {
		$('#the_section').slideUp('slow');
		$('#day_txt_box').slideDown('slow');
	}

	if ($(this).val() == 'The') {
		$('#day_txt_box').slideUp('slow');
		$('#the_section').slideDown('slow');
	}
});

$('input[name=outbound_monthly_day]').on('change', function () {
	if ($(this).val() == 'day') {
		$('#the_section_outbound').slideUp('slow');
		$('#day_txt_box_outbound').slideDown('slow');
	}

	if ($(this).val() == 'The') {
		$('#day_txt_box_outbound').slideUp('slow');
		$('#the_section_outbound').slideDown('slow');
	}
});

$('input[name="duration_inbound_is_end_date"]').on('change', function () {
	if ($(this).val() == 'yes_end_date') {
		$('#duration_inbound_end_date').removeClass('hidden');
		let startDate = inbound_start_date;

		if (startDate) {
			$('#duration_inbound_end_date').attr('min', startDate);
			$('#duration_inbound_end_date').val(startDate);
		}
	} else {
		$('#duration_inbound_end_date').addClass('hidden');
		$('#duration_inbound_end_date').val('');
	}
});

$('input[name="duration_outbound_is_end_date"]').on('change', function () {
	if ($(this).val() == 'yes_end_date') {
		$('#duration_outbound_end_date').removeClass('hidden');
		let startDate = outbound_start_date;

		if (startDate) {
			$('#duration_outbound_end_date').attr('min', startDate);
			$('#duration_outbound_end_date').val(startDate);
		}
	} else {
		$('#duration_outbound_end_date').addClass('hidden');
		$('#duration_outbound_end_date').val('');
	}
});

$('input[name="daily_frequency_type_inbound"]').on('change', function () {
	if ($(this).val() == 'Occurs Once At') {
		$('#recursEveryDiv').hide();
		$('#startingEndingDiv').hide();
		$('#daily_frequency_once_time_inbound').show();
	} else {
		$('#daily_frequency_once_time_inbound').hide();
		$('#recursEveryDiv').show();
		$('#startingEndingDiv').show();
	}
});

$('#duration_inbound_start_date').on('change', function () {
	let startDateInput = $('#duration_inbound_start_date').val();

	if (!startDateInput && inbound_start_date === undefined) {
		const today = new Date();
		const todayFormatted = today.toISOString().split('T')[0];
		inbound_start_date = todayFormatted;
		$('#duration_inbound_start_date').val(todayFormatted);
	} else if (startDateInput) {
		inbound_start_date = startDateInput;
	}

	$('#duration_inbound_end_date').attr('min', inbound_start_date);
	let endDateInput = $('#duration_inbound_end_date').val();

	if (endDateInput && new Date(endDateInput) < new Date(inbound_start_date)) {
		$('#duration_inbound_end_date').val(inbound_start_date);
	}
});

$('#duration_outbound_start_date').on('change', function () {
	let startDateInput = $('#duration_outbound_start_date').val();

	if (!startDateInput && outbound_start_date === undefined) {
		const today = new Date();
		const todayFormatted = today.toISOString().split('T')[0];
		outbound_start_date = todayFormatted;
		$('#duration_outbound_start_date').val(todayFormatted);
	} else if (startDateInput) {
		outbound_start_date = startDateInput;
	}

	$('#duration_outbound_end_date').attr('min', outbound_start_date);
	let endDateInput = $('#duration_outbound_end_date').val();

	if (endDateInput && new Date(endDateInput) < new Date(outbound_start_date)) {
		$('#duration_outbound_end_date').val(outbound_start_date);
	}
});

$('input[name="daily_frequency_type_outbound"]').on('change', function () {
	if ($(this).val() == 'Occurs Once At') {
		$('#recursEveryDivOutbound').hide();
		$('#startingEndingDivOutbound').hide();
		$('#daily_frequency_once_time_outbound').show();
	} else {
		$('#daily_frequency_once_time_outbound').hide();
		$('#recursEveryDivOutbound').show();
		$('#startingEndingDivOutbound').show();
	}
});

$('input[name=schedule_type_inbound]').on('change', function () {
	if ($(this).val() == 'Recurring') {
		$('#inbound-data-one-time').hide();
		$('#inbound-data-recurring').show();
	} else {
		$('#inbound-data-one-time').show();
		$('#inbound-data-recurring').hide();
	}
});

$('input[name=schedule_type_outbound]').on('change', function () {
	if ($(this).val() == 'Recurring') {
		$('#outbound-data-one-time').hide();
		$('#outbound-data-recurring').show();
	} else {
		$('#outbound-data-one-time').show();
		$('#outbound-data-recurring').hide();
	}
});

$('.touchspin').TouchSpin({
	buttondown_class: 'btn btn-primary',
	buttonup_class: 'btn btn-primary',
	buttondown_txt: feather.icons['minus'].toSvg(),
	buttonup_txt: feather.icons['plus'].toSvg()
});

$('.touchspin-icon').TouchSpin({
	buttondown_txt: feather.icons['chevron-down'].toSvg(),
	buttonup_txt: feather.icons['chevron-up'].toSvg()
});

let touchspinValue = $('.touchspin-min-max'),
	counterMin = 1,
	counterMax = 31;
if (touchspinValue.length > 0) {
	touchspinValue
		.TouchSpin({
			min: counterMin,
			max: counterMax,
			buttondown_txt: feather.icons['minus'].toSvg(),
			buttonup_txt: feather.icons['plus'].toSvg()
		})
		.on('touchspin.on.startdownspin', function () {
			let $this = $(this);
			$('.bootstrap-touchspin-up').removeClass('disabled-max-min');

			if ($this.val() == counterMin) {
				$(this).siblings().find('.bootstrap-touchspin-down').addClass('disabled-max-min');
			}
		})
		.on('touchspin.on.startupspin', function () {
			let $this = $(this);
			$('.bootstrap-touchspin-down').removeClass('disabled-max-min');

			if ($this.val() == counterMax) {
				$(this).siblings().find('.bootstrap-touchspin-up').addClass('disabled-max-min');
			}
		});
}

$('.touchspin-step').TouchSpin({
	step: 5,
	buttondown_txt: feather.icons['minus'].toSvg(),
	buttonup_txt: feather.icons['plus'].toSvg()
});

$('.touchspin-color').each(function (index) {
	let down = 'btn btn-primary',
		up = 'btn btn-primary',
		$this = $(this);

	if ($this.data('bts-button-down-class')) {
		down = $this.data('bts-button-down-class');
	}

	if ($this.data('bts-button-up-class')) {
		up = $this.data('bts-button-up-class');
	}

	$this.TouchSpin({
		mousewheel: false,
		buttondown_class: down,
		buttonup_class: up,
		buttondown_txt: feather.icons['minus'].toSvg(),
		buttonup_txt: feather.icons['plus'].toSvg()
	});
});

function addRepeaterValidation(row) {
	$(row).find('[name$="[select-party]"]').rules('add', {
		required: true
	});

	$(row).find('[name$="[endpoint]"]').rules('add', {
		required: true
	});
}

if ($('#form-item-create').length) {
	itemInit();
}

async function itemInit() {
	await new Promise(function (resolve, reject) {
		getAllCompanies()
			.then(responseCompanies => {
				if (responseCompanies.status === 1) {
					const selectCompany = document.getElementById('select-item-company');
					selectCompany.innerHTML = '<option value="">-- Please Select --</option>';
					responseCompanies.data.forEach(item => {
						const option = document.createElement('option');
						option.value = item._id;
						option.textContent = item.name;
						option.setAttribute('data-name', item.name);
						selectCompany.appendChild(option);
					});
					companyOptionGlobal = responseCompanies.data || [];
					resolve();
				} else {
					resolve();
				}
			})
			.catch(error => {
				console.error('Error fetching companies:', error);
				resolve();
			});
	})
		.then(async () => {
			await editItems();
		})
		.catch(error => {
			console.error('Error in itemInit:', error);
		});
}

function fetchMappings(companyId, projectId) {
	return $.ajax({
		url: `/template/mapping-profiles/all-project-mapping-profile`,
		method: 'POST',
		contentType: 'application/json',
		data: JSON.stringify({ projectId: projectId != ' ' ? projectId : null, companyId: companyId }),
	}).then(response => {
		if (response.status == 1) {
			const selectInboundDefaultMapping = document.getElementById('select-inbound-default-mapping');
			const selectOutboundDefaultMapping = document.getElementById('select-outbound-default-mapping');
			// Clear existing options
			selectInboundDefaultMapping.innerHTML = '';
			selectOutboundDefaultMapping.innerHTML = '';

			const defaultOptionInbound = document.createElement('option');
			defaultOptionInbound.value = ' ';
			defaultOptionInbound.textContent = '-- Please Select --';
			selectInboundDefaultMapping.appendChild(defaultOptionInbound);

			const defaultOptionOutbound = document.createElement('option');
			defaultOptionOutbound.value = ' ';
			defaultOptionOutbound.textContent = '-- Please Select --';
			selectOutboundDefaultMapping.appendChild(defaultOptionOutbound);

			let boundOptions = [];
			response.data.forEach(item => {
				if (item.histories && item.histories.length > 0) {
					let versionSet = new Set();
					for (let i = item.histories.length - 1; i >= 0; i--) {
						let currentVersion = item.histories[i].version;
						if (versionSet.has(currentVersion)) continue;
						versionSet.add(currentVersion);

						const optionText = `${item.histories[i].name} (${item.histories[i].version})`;
						const outboundOption = document.createElement('option');
						outboundOption.value = `${item._id}-${item.histories[i].version}`;
						outboundOption.textContent = optionText;
						outboundOption.setAttribute('data-name', optionText);
						outboundOption.setAttribute('data-key', item._id);
						selectOutboundDefaultMapping.appendChild(outboundOption);

						const inboundOption = document.createElement('option');
						inboundOption.value = `${item._id}-${item.histories[i].version}`;
						inboundOption.textContent = optionText;
						inboundOption.setAttribute('data-name', optionText);
						inboundOption.setAttribute('data-key', item._id);
						selectInboundDefaultMapping.appendChild(inboundOption);

						boundOptions.push({
							id: `${item._id}-${item.histories[i].version}`,
							text: optionText,
							key: item._id,
							version: item.histories[i].version,
						});
					}
				}
			});

			boundOptionsGlobal = boundOptions;
		} else {
			return Promise.reject(response.message);
		}
	});
}

function fetchParties(projectId, environmentId) {
	return $.ajax({
		url: `/master/parties/all-project-parties`,
		method: 'POST',
		contentType: 'application/json',
		data: JSON.stringify({ projectId: projectId == " " ? null : projectId, environmentId: environmentId }),
	}).then(response => {
		partiesOptionsGlobal = [];
		if (response.status == 1) {
			partiesOptionsGlobal = response.data.map(item => ({
				id: item._id,
				text: item.name
			}));
		} else {
			return Promise.reject(response.message);
		}
	});
}

async function editItems() {
	const id = $('#item-id').val();
	if (id) {
		logsItemId = $('#item-id').val();
		$('.step-trigger').removeAttr('disabled');
		$('body').on('click', '.bs-stepper-header .step', function () {
			const dataID = $(this).attr('data-target');
			let stepper = new Stepper(document.querySelector('.bs-stepper'));

			if (dataID == '#item-step') {
				stepper.to(1);
			} else if (dataID == '#inbound-step') {
				stepper.to(2);
			} else if (dataID == '#outbound-step') {
				stepper.to(3);
			} else if (dataID == '#schedule-step') {
				stepper.to(4);
			} else if (dataID == '#alert-step') {
				stepper.to(5);
			} else if (dataID == '#members-step') {
				stepper.to(6);
			} else if (dataID == '#logs-step') {
				stepper.to(7);
			}

			$('.step-trigger').removeAttr('disabled');
		});

		try {
			await itemGet(id);
			await inboundGet(id);
			await outboundGet(id);
			await scheduleSetting(id);
			await getAlertcondition(itemAlertPerPage, itemAlertCurrentPage, id);
			await alertConditionList(id);

			const now = new Date();
			itemLogToDate = now.toISOString();
			itemLogFromDate = new Date(now.getTime() - 30 * 60000).toISOString();

			const startMoment = moment(itemLogFromDate);
			const endMoment = moment(itemLogToDate);

			const drp = $('#itemLogRange').data('daterangepicker');

			if (drp) {
				drp.setStartDate(startMoment);
				drp.setEndDate(endMoment);

				const rangesList = $('.ranges li');
				rangesList.removeClass('active');

				// Match preset label with tolerance
				let matchedLabel = null;
				const ranges = drp.ranges || {};

				function areMomentsClose(m1, m2, toleranceMinutes = 1) {
					return Math.abs(m1.diff(m2, 'minutes')) <= toleranceMinutes;
				}

				for (const [label, range] of Object.entries(ranges)) {
					const presetStart = moment(range[0]);
					const presetEnd = moment(range[1]);
					if (areMomentsClose(startMoment, presetStart) && areMomentsClose(endMoment, presetEnd)) {
						matchedLabel = label;
						break;
					}
				}

				if (matchedLabel) {
					rangesList.each(function () {
						if ($(this).data('range-key') === matchedLabel) {
							$(this).addClass('active');
						}
					});
					$('#itemLogRange span').html(matchedLabel);
					$('.since-time-item').text(matchedLabel);
				} else {
					const formattedRange = `${startMoment.format('MMMM D, YYYY HH:mm:ss')} - ${endMoment.format('MMMM D, YYYY HH:mm:ss')}`;
					$('#itemLogRange span').html(formattedRange);
					$('.since-time-item').text('');
					rangesList.each(function () {
						if ($(this).data('range-key') === "Custom Range") {
							$(this).addClass('active');
						}
					});
				}
			}

			// Fix: Use startMoment and endMoment instead of undefined start/end
			itemLogFromDate = startMoment.toISOString();
			itemLogToDate = endMoment.toISOString();

			await logListApi(logsCurrentPage, logsPerPage, type = "log", id, itemLogFromDate, itemLogToDate)
		} catch (errorMessage) {
			console.log(errorMessage)
		}
	} else {
		const selectedCompanyValue = getCookie('selectedCompany');
		const selectedProjectValue = getCookie('selectedProject');
		const companyCode = getCookie('selectedProject');
		reponseGloabalSetting = await getGeneralSettings(companyCode);
		if (selectedCompanyValue && selectedProjectValue) {
			const selectCompany = $('#select-item-company');
			const selectProject = $('#select-item-project');

			selectCompany.data('programmaticChange', true)
			selectProject.data('programmaticChange', true);
			selectCompany.val(selectedCompanyValue).trigger('change');

			await getProjects(selectedCompanyValue, selectedProjectValue);
			await getEnvironments(selectCompany.val(), selectedProjectValue, '');
			await fetchMappings(selectedCompanyValue, selectedProjectValue);
			// await fetchParties(selectedProjectValue);

			selectCompany.data('programmaticChange', false)
			selectProject.data('programmaticChange', false);
		} else if (selectedCompanyValue) {
			const selectCompany = $('#select-item-company');
			const selectProject = $('#select-item-project');
			selectCompany.data('programmaticChange', true);
			selectProject.data('programmaticChange', true);
			selectCompany.val(selectedCompanyValue).trigger('change');
			await getProjects(selectedCompanyValue, '');
			await getEnvironments(selectCompany.val(), " ");
			await fetchParties(" ");
			selectCompany.data('programmaticChange', false)
			selectProject.data('programmaticChange', false);
		}

		const defaultInboundMapping = $('#select-inbound-default-mapping');
		const defaultOutboundMapping = $('#select-outbound-default-mapping');

		defaultInboundMapping.val(' ').trigger('change');
		defaultOutboundMapping.val(' ').trigger('change');

		$('#logs-data-table tbody').empty();
		if (logsTable) {
			logsTable.clear().draw();
		}

		resetElements();
		addRowToOutboundEndpointTable();
	}
}

function itemGet(id) {
	return new Promise((resolve, reject) => {
		$.ajax({
			url: '/projects/get/' + id,
			method: 'GET',
		}).then(async response => {
			if (response.status == 1) {
				const data = response?.data;
				await fillItemData(data)
				resolve();
			} else {
				resolve()
			}
		}).catch(error => {
			console.log(error, "error")
			reject('Error fetching item data')
		});
	});
}

function inboundGet(id) {
	return new Promise((resolve, reject) => {
		$.ajax({
			url: '/projects/inbounds/get/' + id,
			method: 'GET',
		}).then(async response => {
			if (response.status == 1) {
				const data = response?.data;
				await fillInboundData(data)
				resolve();
			} else {
				resolve();
			}
		}).catch(error => reject('Error fetching inbound data'));
	});
}

$('#select-inbound-default-mapping, #select-outbound-default-mapping').on('change', function () {
	toggleClearButton($(this));
});

function toggleClearButton(element) {
	let value = element.val();

	// Prevent recursion
	if (value === null) {
		// just set the value silently, no event
		element.val(' ');
		value = ' ';
	}

	const containerId = element.attr('id');
	const select2Container = $(`#select2-${containerId}-container`).parent();
	const clearButton = select2Container.find('.select2-selection__clear');

	if ((value === '' || value === ' ') && clearButton.length) {
		clearButton.css('display', 'none');
	} else if (clearButton.length) {
		clearButton.css('display', 'block');
	}
}

function outboundGet(id) {
	return new Promise((resolve, reject) => {
		$.ajax({
			url: '/projects/outbounds/get/' + id,
			method: 'GET',
		}).then(async response => {
			if (response.status == 1) {
				const data = response?.data;
				await fillOutboundData(data);
				resolve();
			} else {
				$('#outbound-endpoint-data-table tbody').empty();
				outboundEndpointDataRowCounter = 0;
				addRowToOutboundEndpointTable();
				resolve();
			}
		}).catch(error => reject('Error fetching outbound data'));
	});
}

function scheduleSetting(id) {
	return new Promise((resolve, reject) => {
		$.ajax({
			url: '/projects/schedules/get/' + id,
			method: 'GET',
		}).then(async response => {
			if (response.status == 1) {
				const data = response?.data;
				await fillScheduleUI(data);
				resolve();
			} else {
				resolve();
			}

		}).catch(error => reject('Error fetching outbound data'));
	});
}

function alertConditionList(id) {
	return new Promise((resolve, reject) => {
		$.ajax({
			url: '/alerts/alert-conditions/list-by-item/' + id,
			method: 'POST',
		}).then(async response => {
			if (response.status == 1) {
				const data = response?.data;
				resolve();
			} else {
				resolve();
			}

		}).catch(error => reject('Error fetching outbound data'));
	});
}

function outboundEndPointMapping(endpoints, resetValue = false) {
	if (resetValue) {
		$('#outbound-endpoint-data-table tbody').empty();
	}

	triggerRulesJson = {};

	endpoints.forEach((endpoint, index) => {
		const party = endpoint?.party || '';
		const endpointValue = endpoint?.endpoint || '';

		let inboundValue = endpoint.inboundMapping;
		let outboundValue = endpoint.outboundMapping;
		let inboundMappingVersion = endpoint.inboundMappingVersion;
		let outboundMappingVersion = endpoint.outboundMappingVersion;

		if (inboundValue == '') {
			inboundValue = ' ';
		}

		if (outboundValue == '') {
			outboundValue = ' ';
		}

		if (resetValue) {
			inboundValue = ' ';
			outboundValue = ' ';
		}

		if (party && endpointValue || resetValue) {
			addRowToOutboundEndpointTable();
		}

		let inboundMapping = inboundValue !== ' ' ? inboundValue.concat('-', inboundMappingVersion) : ' ';
		let outboundMapping = outboundValue !== ' ' ? outboundValue.concat('-', outboundMappingVersion) : ' ';

		$(`#outbound-endpoint-status-${index}`).prop('checked', endpoint.status === true).trigger('change');
		$(`#select-party-${index}`).val(party).trigger('change');
		$(`#endpoint-${index}`).val(endpointValue).trigger('change');
		$(`#select-inbound-mapping-${index}`).val(inboundMapping).trigger('change');
		$(`#select-outbound-mapping-${index}`).val(outboundMapping).trigger('change');
		$(`#outbound-default-response-status-${index}`).prop('checked', endpoint.default_response === true).trigger('change');

		if (resetValue) {
			triggerRulesJson[`row-${index}`] = [];
			specifyHeaderJson[`row-${index}`] = {
				headers: [],
				globalVariablesBeforeTrigger: [],
				globalVariablesAfterResponse: [],
				actionsArray: [],
				templateInbound: '',
				templateOutbound: '',
				logDescription: '',
				beforeLogDescription: '',
				notificationEmailTitle: '',
				notificationEmail: '',
				disableInboundEmail: false,
				disableOutboundEmail: false,
				request_method: 'DEFAULT'
			};
		} else {
			if (endpoint.triggerRules && endpoint.triggerRules.length > 0) {
				triggerRulesJson[`row-${index}`] = endpoint.triggerRules;
			} else {
				$('table.outbound-validation-rules-table tbody').empty();
				validationRowCounter = 0;
				addRowToOutBoundValidaitonRow();
			}

			if (endpoint.specifyHeaders && endpoint.specifyHeaders) {
				specifyHeaderJson[`row-${index}`] = {
					headers: endpoint.specifyHeaders.headers || [],
					globalVariablesBeforeTrigger: endpoint.specifyHeaders.globalVariablesBeforeTrigger || [],
					globalVariablesAfterResponse: endpoint.specifyHeaders.globalVariablesAfterResponse || [],
					actionsArray: endpoint.specifyHeaders.actionsArray || [],
					templateInbound: endpoint.specifyHeaders.templateInbound,
					templateOutbound: endpoint.specifyHeaders.templateOutbound,
					logDescription: endpoint.specifyHeaders.logDescription,
					beforeLogDescription: endpoint.specifyHeaders.beforeLogDescription,
					notificationEmailTitle: endpoint.specifyHeaders.notificationEmailTitle,
					notificationEmail: endpoint.specifyHeaders.notificationEmail,
					disableInboundEmail: endpoint.specifyHeaders.disableInboundEmail,
					disableOutboundEmail: endpoint.specifyHeaders.disableOutboundEmail,
					request_method: endpoint.specifyHeaders.request_method || 'DEFAULT',
				};
			} else {
				$('table.outbound-specify-headers-table tbody').empty();
				specifyHeaderCounter = 0;
				addRowToSpecifyHeaderRow();
			}
		}
	});
}

$('body').on('change', 'input:radio[name=platform]', function () {
	$('.platform-ftp-options').hide();
	$('.platform-api-options').hide();

	if (this.value == 'FTP' || this.value == 'SFTP') {
		$('.platform-ftp-options').show();
	}

	if (this.value == 'API') {
		$('.platform-api-options').show();
	}
});

$('body').on('change', 'input:radio[name=platform-api-type]', function () {
	$('.ddep-api-type').hide();
	$('.user-api-type').hide();

	if (this.value == 'DDEP_API') {
		$('.ddep-api-type').show();
	}

	if (this.value == 'User_API') {
		$('.user-api-type').show();
	}
});

const resetElements = () => {
	$('.authorization-api-key, .authorization_jwt_bearer, .hmac-fields, .jwt_type, .api-key-data-table').hide();
	$('#api-key-data-table thead').empty();
	$('#api-key-data-table tbody').empty();
	authorizationApiKeyArray = [];
};

$('body').on('change', 'select[name=select-ddep-api-auth-type]', function () {
	const authType = this.value

	resetElements();

	const apiKeyHeader = `
		<tr class="authorization_api_keys_table_head">
			<th></th>
			<th>Type</th>
			<th>Key</th>
			<th>Description</th>
			<th>Expiry Date (optional)</th>
			<th></th>
		</tr>
	`;
	const jwtBearerHeader = `
		<tr class="authorization_api_keys_table_head">
			<th></th>
			<th>Jwt Type</th>
			<th>Base64 Encoded</th>
			<th>Type</th>
			<th>Key</th>
			<th>Description</th>
			<th>Expiry Date (optional)</th>
			<th></th>
		</tr>
	`;

	if (authType === 'API_Key') {
		$('.authorization-api-key').css('display', 'block');
		$('#api-key-data-table thead').html(apiKeyHeader);
		$('.authorization_api_keys_table').show();
	}

	if (authType === 'JWT_Bearer') {
		$('.authorization-api-key, .authorization_jwt_bearer, .hmac-fields, .jwt_type').css('display', 'block');
		$('#api-key-data-table thead').html(jwtBearerHeader);
		$('.api-key-data-table').show();
	}
});

$('body').on('change', 'input:radio[name=flow-api-type]', function () {
	$('.single-api-type').hide();
	$('.multiple-api-type').hide();

	if (this.value == 'single') {
		triggerRulesJson = {};
		specifyHeaderJson = {};

		$('table.outbound-validation-rules-table tbody').empty();
		specifyHeaderCounter = 0;
		addRowToOutBoundValidaitonRow();

		$('table.outbound-specify-headers-table tbody').empty();
		validationRowCounter = 0;
		addRowToSpecifyHeaderRow();

		$('#outbound-endpoint-data-table tbody').empty();
		outboundEndpointDataRowCounter = 0;
		addRowToOutboundEndpointTable();

		$('.single-api-type').show();
		sortbleTable('single');
	}

	if (this.value == 'multiple') {
		triggerRulesJson = {};
		specifyHeaderJson = {};

		$('table.outbound-validation-rules-table tbody').empty();
		addRowToOutBoundValidaitonRow();

		$('table.outbound-specify-headers-table tbody').empty();
		addRowToSpecifyHeaderRow();

		$('#outbound-endpoint-data-table tbody').empty();
		outboundEndpointDataRowCounter = 0;
		addRowToOutboundEndpointTable();

		$('.multiple-api-type').show();
		sortbleTable('multiple');
	}
});

function sortbleTable(type) {
	if (type === 'multiple') {
		$('#outbound-endpoint-data-table tbody').sortable({
			items: 'tr',
			cursor: 'pointer',
			axis: 'y',
			dropOnEmpty: false,
			start: function (e, ui) {
				ui.item.addClass('selected');
			},
			stop: function (e, ui) {
				ui.item.removeClass('selected');
			},
		});
	} else {
		if ($('#outbound-endpoint-data-table tbody').data('ui-sortable')) {
			$('#outbound-endpoint-data-table tbody').sortable('destroy');
		}
	}
}

function generateApiKeyRow(type, key = '', description = '', jwtType = '', base64Encode = '', expiryDate = '') {
	let newRow = '<tr>';
	let newCols = '';
	let ddepApiType = $('select[name=select-ddep-api-auth-type]').val();

	newCols += '<td class="col-sm-1"><div class="custom-control custom-checkbox"><input type="checkbox" name="api-key-status" id="api-key-status-' + apiKeyCounter + '" class="custom-control-input" checked /><label class="custom-control-label" for="api-key-status-' + apiKeyCounter + '"></label></div></td>';

	if (ddepApiType === 'JWT_Bearer') {
		newCols += `
			<td class="col-sm-1">
				<input type="text" name="jwt-type" class="form-control border-0 bg-white" id="jwt-type-${apiKeyCounter}" value="${jwtType}" disabled />
			</td>
			<td class="col-sm-1">
				<input type="text" name="base64-encoded" class="form-control border-0 bg-white" id="base64-encoded-${apiKeyCounter}" value="${base64Encode}" disabled />
			</td>
		`;
	}

	newCols += `
		<td class=${ddepApiType === 'JWT_Bearer' ? "col-sm-2" : "col-sm-3"}>
			<input type="text" name="type" class="form-control border-0 bg-white" id="api-key-type-${apiKeyCounter}" value="${type}" disabled />
		</td>
		<td class=${ddepApiType === 'JWT_Bearer' ? "col-sm-2" : "col-sm-3"}>
			<input type="text" name="key" class="form-control border-0 ${type === 'Auto Generated' ? 'bg-white' : ''}" id="api-key-key-${apiKeyCounter}" value="${key}" ${type === 'Auto Generated' ? 'disabled' : ''} />
		</td>
		<td class=${ddepApiType === 'JWT_Bearer' ? "col-sm-3" : "col-sm-3"}>
			<input type="text" name="description" class="form-control border-0" id="api-key-description-${apiKeyCounter}" value="${description}" />
		</td>
		<td class="col-sm-1">
			<input type="date" name="expiry-date" class="form-control border-0 expiry-date-input" id="api-key-expiry-${apiKeyCounter}" value="${expiryDate}" />
		</td>
	`;

	newCols += '<td class="col-sm-2 text-center"><a href="javascript:void(0);" type="button" class="api-key-btn-del btn-del btn btn-lg modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';

	newRow += newCols;
	newRow += '</tr>';

	$('#api-key-data-table tbody').append(newRow);

	apiKeyCounter++;
}

$('body').on('click', '#generate-subscription-key-btn', function () {
	let selectedAuthType = $('select[name=select-ddep-api-auth-type]').val();
	generateApiKeyRequest('Auto Generated', selectedAuthType).then((data) => {
		generateApiKeyRow(data.Type, data.Key, data.Description, data.JwtType, data.Base64Encode, data.expiryDate);
	}).catch(handleError);
});

$('body').on('click', '#generate-custom-key-btn', function () {
	let jwtType = $('#jwt_algorithm').val();
	let base64Encode = $('#base64-encode').is(':checked');
	generateApiKeyRow('Custom Key', '', '', jwtType, base64Encode, '');
});

function generateApiKeyRequest(type, authType) {
	return new Promise((resolve, reject) => {
		$('.overlay, body').removeClass('loaded');
		$('.overlay').css({ 'display': 'block' });

		let authorizationApiKeyArrayObj = {
			Type: type,
			Key: '',
			jwt_algorithm_type: '',
			base64Encode: '',
			expiryDate: '',
		};

		if (authType === 'JWT_Bearer') {
			authorizationApiKeyArrayObj.jwt_algorithm_type = $('#jwt_algorithm').val();
			authorizationApiKeyArrayObj.base64Encode = $('#base64-encode').is(':checked');
			authorizationApiKeyArrayObj.ddep_api_auth_type = 'JWT_Bearer';
		}

		$.ajax({
			url: '/generatekey',
			method: 'POST',
			dataType: 'json',
			data: JSON.stringify(authorizationApiKeyArrayObj),
			headers: {
				'Content-Type': 'application/json'
			},
			success: function (response) {
				authorizationApiKeyArrayObj['Key'] = response.data.key;
				authorizationApiKeyArrayObj['date'] = response.data.date;
				authorizationApiKeyArrayObj['expiryDate'] = response.data.expiryDate || '';
				if (authType === 'JWT_Bearer') {
					authorizationApiKeyArrayObj['JwtType'] = authorizationApiKeyArrayObj.jwt_algorithm_type || '';
					authorizationApiKeyArrayObj['Base64Encode'] = authorizationApiKeyArrayObj.base64Encode;
				}

				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });
				resolve(authorizationApiKeyArrayObj);
			},
			error: function (xhr, status, error) {
				reject(xhr);
			}
		});
	});
}

function handleError(error) {
	$('.overlay, body').addClass('loaded');
	$('.overlay').css({ 'display': 'none' });

	Swal.fire({
		title: 'Error!',
		text: error.responseJSON?.message || 'An unexpected error occurred.',
		icon: 'error',
		customClass: {
			confirmButton: 'btn btn-primary'
		},
		buttonsStyling: false,
		timer: 1200
	});
}

$('body').on('click', '#api-key-data-table .api-key-btn-del', function (event) {
	$(this).closest('tr').remove();
});

$('body').on('change', 'input:radio[name=flow]', function () {
	$('.flow-ftp-options').hide();
	$('.flow-api-options').hide();

	if (this.value == 'FTP') {
		$('.flow-ftp-options').show();
	}

	if (this.value == 'API') {
		$('.flow-api-options').show();
	}
});

$('body').on('click', '#outbound-global-headers-btn-add-row', function () {
	let newRow = '<tr>';
	let newCols = '';

	newCols += '<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound-global-headers-status" id="outbound-global-headers-status-' + outboundGlobalHeadersRowCounter + '" class="custom-control-input" checked /><label class="custom-control-label" for="outbound-global-headers-status-' + outboundGlobalHeadersRowCounter + '"></label></div></td>';
	newCols += '<td class="col-sm-3"><input type="text" name="outbound-global-headers[][key]" class="form-control border-0" id="outbound-global-headers-key-' + outboundGlobalHeadersRowCounter + '" /></td>';
	newCols += '<td class="col-sm-4"><input type="text" name="outbound-global-headers[][value]" class="form-control border-0" id="outbound-global-headers-value-' + outboundGlobalHeadersRowCounter + '" /></td>';
	newCols += '<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound-global-headers-mask" id="outbound-global-headers-mask-' + outboundGlobalHeadersRowCounter + '" class="custom-control-input" checked /><label class="custom-control-label" for="outbound-global-headers-mask-' + outboundGlobalHeadersRowCounter + '"></label></div></td>';
	newCols += '<td class="col-sm-3"><input type="text" name="outbound-global-headers[][description]" class="form-control border-0" id="outbound-global-headers-description-' + outboundGlobalHeadersRowCounter + '" /></td>';
	newCols += '<td class="col-sm-1 text-center"><a href="javascript:void(0);" type="button" class="btn btn-lg btn-del modal-button outbound-global-headers-btn-del"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';

	newRow += newCols;
	newRow += '</tr>';

	$('#outbound-global-headers-table tbody').append(newRow);

	outboundGlobalHeadersRowCounter++;
});

$('body').on('click', '.outbound-global-headers-btn-del', function (event) {
	$(this).closest('tr').remove();
});

$('body').on('click', '#inbound-default-mapping-settings-button', function () {
	const inboundSelectedOption = $('#select-inbound-default-mapping').find('option:selected');
	const inboundSelectedValue = inboundSelectedOption.val();
	globalMappingId = inboundSelectedValue;

	if (inboundSelectedValue) {
		let find = boundOptionsGlobal.find((item) => item.id == inboundSelectedValue);
		itemProperties = [];
		if (find) editMappingProfileData(find);
	}
});

$('body').on('click', '#outbound-default-mapping-settings-button', function () {
	const outboundSelectedOption = $('#select-outbound-default-mapping').find('option:selected');
	const outboundSelectedValue = outboundSelectedOption.val();
	globalMappingId = outboundSelectedValue;

	if (outboundSelectedValue) {
		let find = boundOptionsGlobal.find((item) => item.id == outboundSelectedValue);
		itemProperties = [];
		if (find) editMappingProfileData(find);
	}
});

$('body').on('click', '#outbound-endpoint-btn-add-row', function () {
	addRowToOutboundEndpointTable();
});

function addRowToOutboundEndpointTable() {
	const isSingleApiType = $('input[name="flow-api-type"]:checked').val() === 'single';

	if (isSingleApiType && outboundEndpointDataRowCounter > 0) {
		Swal.fire({
			title: 'Error!',
			text: 'Only one row is allowed for Single API Type.',
			icon: 'error',
			customClass: {
				confirmButton: 'btn btn-primary'
			},
			buttonsStyling: false,
			timer: 1200
		});

		return;
	}

	let newRow = `<tr data-id="${outboundEndpointDataRowCounter}"> id="prop-format-additional-rules-table-row-${outboundEndpointDataRowCounter}"`;
	let newCols = '';

	if (!isSingleApiType) {
		newCols += '<td class="format-rules-icon text-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-code font-medium-2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></td>';
	}

	newCols += '<td><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound-endpoint-status" id="outbound-endpoint-status-' + outboundEndpointDataRowCounter + '" class="custom-control-input" checked /><label class="custom-control-label" for="outbound-endpoint-status-' + outboundEndpointDataRowCounter + '"></label></div></td>';
	newCols += '<td><div class="d-flex mapping-profile-dropdown"><div><select class="select2 form-control form-control-lg" id="select-party-' + outboundEndpointDataRowCounter + '" name="repeater[' + outboundEndpointDataRowCounter + '][select-party]"></select></div><button type="button" class="btn btn-primary party-edit-button party-settings-button m-0" id="party-settings-button-' + outboundEndpointDataRowCounter + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit align-middle"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button></div></td>';
	newCols += '<td><input type="text" name="repeater[' + outboundEndpointDataRowCounter + '][endpoint]" class="form-control border-0" id="endpoint-' + outboundEndpointDataRowCounter + '" /></td>';
	newCols += '<td><div class="d-flex mapping-profile-dropdown"><div><select class="select2 form-control form-control-lg" id="select-inbound-mapping-' + outboundEndpointDataRowCounter + '" name="repeater[' + outboundEndpointDataRowCounter + '][select-inbound-mapping]"></select></div><button type="button" class="btn btn-primary mapping-edit-button inbound-mapping-settings-button m-0" id="inbound-mapping-settings-button-' + outboundEndpointDataRowCounter + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit align-middle"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button></div></td>';
	newCols += '<td><div class="d-flex mapping-profile-dropdown"><div><select class="select2 form-control form-control-lg" id="select-outbound-mapping-' + outboundEndpointDataRowCounter + '" name="repeater[' + outboundEndpointDataRowCounter + '][select-outbound-mapping]"></select></div><button type="button" class="btn btn-primary mapping-edit-button outbound-mapping-settings-button m-0" id="outbound-mapping-settings-button-' + outboundEndpointDataRowCounter + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit align-middle"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button></div></td>';
	newCols += '<td><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound-default-response-status" id="outbound-default-response-status-' + outboundEndpointDataRowCounter + '" class="custom-control-input"/><label class="custom-control-label" for="outbound-default-response-status-' + outboundEndpointDataRowCounter + '"></label></div></td>';
	// newCols += '<td class="text-center"><button type="button" class="btn btn-primary mapping-trigger-rules m-0" id="mapping-trigger-rules-' + outboundEndpointDataRowCounter + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-settings align-middle"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></button></td>';
	newCols += '<td class="text-center"><button type="button" class="btn btn-primary mapping-auth m-0" id="mapping-auth-' + outboundEndpointDataRowCounter + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-settings align-middle"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></button></td>';

	if (!isSingleApiType) {
		newCols += `<td class="text-center"><a href="javascript:void(0);" type="button" class="outbound-endpoint-btn-del btn-del btn btn-lg modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>`;
	}

	newRow += newCols;
	newRow += '</tr>';

	$('#outbound-endpoint-data-table tbody').append(newRow);

	initSelect2ForNewRow(outboundEndpointDataRowCounter);

	const $newRow = $('#outbound-endpoint-data-table tbody').find('tr').last();
	addRepeaterValidation($newRow);

	$('#form-outbound-create').validate();

	outboundEndpointDataRowCounter++;
}

$('body').on('change', 'input[name="outbound-default-response-status"]', function () {
	if ($(this).is(':checked')) {
		$('input[name="outbound-default-response-status"]').not(this).prop('checked', false);
	}
});

function initSelect2ForNewRow(rowCounter) {
	$('#select-party-' + rowCounter).wrap('<div class="position-relative"></div>').select2({
		data: partiesOptionsGlobal,
		width: '100%',
		placeholder: '-- Please Select --',
		dropdownParent: $('#select-party-' + rowCounter).parent()
	}).val(null).trigger('change');

	$('#select-inbound-mapping-' + rowCounter).wrap('<div class="position-relative"></div>').select2({
		data: [{
			id: ' ',
			text: 'Default'
		}, ...boundOptionsGlobal],
		width: '100%',
		placeholder: '-- Please Select --',
		dropdownParent: $('#select-inbound-mapping-' + rowCounter).parent()
	}).val(' ').trigger('change');

	$('#select-outbound-mapping-' + rowCounter).wrap('<div class="position-relative"></div>').select2({
		data: [{
			id: ' ',
			text: 'Default'
		}, ...boundOptionsGlobal],
		width: '100%',
		placeholder: '-- Please Select --',
		dropdownParent: $('#select-outbound-mapping-' + rowCounter).parent()
	}).val(' ').trigger('change');

	$('#inbound-mapping-settings-button-' + rowCounter).on('click', function () {
		const inboundSelectedOption = $('#select-inbound-mapping-' + rowCounter).find('option:selected');
		const inboundSelectedValue = inboundSelectedOption.val();
		globalMappingId = inboundSelectedValue;

		if (inboundSelectedValue) {
			const find = boundOptionsGlobal.find((item) => item.id == inboundSelectedValue);
			itemProperties = [];
			if (find) editMappingProfileData(find);
		}
	});

	$('#outbound-mapping-settings-button-' + rowCounter).on('click', function () {
		const outboundSelectedOption = $('#select-outbound-mapping-' + rowCounter).find('option:selected');
		const outboundSelectedValue = outboundSelectedOption.val();
		globalMappingId = outboundSelectedValue;

		if (outboundSelectedValue) {
			const find = boundOptionsGlobal.find((item) => item.id == outboundSelectedValue);
			itemProperties = [];
			if (find) editMappingProfileData(find);
		}
	});

	$('#party-settings-button-' + rowCounter).on('click', function () {
		const partySelectedOption = $('#select-party-' + rowCounter).find('option:selected');
		const partySelectedValue = partySelectedOption.val();
		globalPartyId = partySelectedValue;

		if (partySelectedValue) {
			const find = partiesOptionsGlobal.find((item) => item.id == partySelectedValue);
			if (find) editPartyData(find);
		}
	});

	$('body').on('select2:open', '#select-party-' + rowCounter, function () {
		const dropdown = $(this).data('select2').dropdown.$search[0].parentElement;

		if (!$(dropdown).find('.add-new-item-btn').length) {
			$(dropdown).append(`
				<button style="width: 100%" type="button" class="btn btn-primary add-new-item-btn" onClick="createParty(${rowCounter})">Create Party</button>
			`);
		}
	});

	$('body').on('select2:open', '#select-inbound-mapping-' + rowCounter, function () {
		const dropdown = $(this).data('select2').dropdown.$search[0].parentElement;

		if (!$(dropdown).find('.add-new-item-btn').length) {
			$(dropdown).append(`
				<button style="width: 100%" type="button" class="btn btn-primary add-new-item-btn" onClick="createMappingProfile(${rowCounter})">Create Mapping Profile</button>
			`);
		}
	});

	$('body').on('select2:open', '#select-outbound-mapping-' + rowCounter, function () {
		const dropdown = $(this).data('select2').dropdown.$search[0].parentElement;

		if (!$(dropdown).find('.add-new-item-btn').length) {
			$(dropdown).append(`
				<button style="width: 100%" type="button" class="btn btn-primary add-new-item-btn" onClick="createMappingProfile(${rowCounter})">Create Mapping Profile</button>
			`);
		}
	});
}

$('body').on('click', '.outbound-endpoint-btn-del', function (event) {
	const rowId = $(this).closest('tr').data('data-id');
	$(this).closest('tr').remove();
	$('#form-outbound-create').validate();

	if (triggerRulesJson[`row-${rowId}`]) {
		delete triggerRulesJson[`row-${rowId}`];
	}

	if (specifyHeaderJson[`row-${rowId}`]) {
		delete specifyHeaderJson[`row-${rowId}`];
	}
});

$("body table.outbound-validation-rules-table tbody").on("change", ".format-then-name", function () {
	var $row = $(this).closest("tr");
	var value = $(this).val();
	var $formulaInput = $row.find(".outbound-validation-rules-table-row-formula input");

	if (value === 'SKIP') {
		$formulaInput.prop("disabled", true).val("");
	} else {
		$formulaInput.prop("disabled", false);
	}
});

$('body').on('click', '#outbound-validation-modal-close', function (event) {
	$('#outbound-validation-modal').modal('hide');
});

$('body').on('click', '#outbound-validation-rules-btn-add-row', function () {
	addRowToOutBoundValidaitonRow();
});

$('body').on('click', '.outbound-validation-rules-btn-del', function (event) {
	$(this).closest('tr').remove();
});

function addRowToOutBoundValidaitonRow() {
	let newRow = '<tr>';
	let cols = '';

	cols += '<td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="validations[][logical]"><option value="AND">AND</option><option value="OR">OR</option></select></td>';
	cols += '<td class="col-sm-3 autocomplete"><input type="text" name="validations[][original]" class="form-control border-0 autocompletevalidation" id="validation-original-' + validationRowCounter + '"/></td>';
	cols += '<td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="validations[][operations]"><option value="==">=</option><option value=">">></option><option value=">=">>=</option><option value="<"><</option><option value="<="><=</option><option value="<>"><></option><option value="Contains">Contains</option></select></td>';
	cols += '<td class="col-sm-2 autocomplete"><input type="text" name="validations[][column]" class="form-control border-0 autocompletevalidation" id="validation-column-' + validationRowCounter + '"/></td>';
	cols += '<td class="col-sm-2"><select class="select-dropdown form-control form-control-lg format-then-name" name="validations[][then]"><option value="SKIP">SKIP</option><option value="STOP">STOP</option></select></td>';
	cols += '<td class="col-sm-2 autocomplete outbound-validation-rules-table-row-formula"><input type="text" name="validations[][formula]" class="form-control border-0 autocompletevalidation" id="validation-validformula-' + validationRowCounter + '"/></td>';
	cols += '<td class="col-sm-2 text-center"><a href="javascript:void(0);" type="button" class="outbound-validation-rules-btn-del btn btn-lg btn-del modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';

	newRow += cols;
	newRow += '</tr>';

	$('table.outbound-validation-rules-table tbody').append(newRow);

	validationRowCounter++;
}

$('body').on('click', '.mapping-auth', function (event) {
	let trElement = event.target.closest('tr');
	let dataId = trElement.getAttribute('data-id');
	currentRowId = trElement.getAttribute('data-id');

	$('#outbound-specify-headers-id').val(dataId);
	$('#outbound-specify-headers-modal').modal('show');

	$('#outbound-specify-headers-table tbody').sortable({
		items: 'tr',
		cursor: 'pointer',
		axis: 'y',
		dropOnEmpty: false,
		start: function (e, ui) {
			ui.item.addClass('selected');
		},
		stop: function (e, ui) {
			ui.item.removeClass('selected');
		},
	});

	$('#outbound-global-variables-before-outbound-trigger-table tbody').sortable({
		items: 'tr',
		cursor: 'pointer',
		axis: 'y',
		dropOnEmpty: false,
		start: function (e, ui) {
			ui.item.addClass('selected');
		},
		stop: function (e, ui) {
			ui.item.removeClass('selected');
		},
	});

	$('#outbound-global-variables-after-response-table tbody').sortable({
		items: 'tr',
		cursor: 'pointer',
		axis: 'y',
		dropOnEmpty: false,
		start: function (e, ui) {
			ui.item.addClass('selected');
		},
		stop: function (e, ui) {
			ui.item.removeClass('selected');
		},
	});

	$('#outbound-actions-table tbody').sortable({
		items: 'tr',
		cursor: 'pointer',
		axis: 'y',
		dropOnEmpty: false,
		start: function (e, ui) {
			ui.item.addClass('selected');
		},
		stop: function (e, ui) {
			ui.item.removeClass('selected');
		},
	});

	if (!specifyHeaderJson[`row-${dataId}`]) {
		specifyHeaderJson[`row-${dataId}`] = {
			headers: [],
			globalVariablesBeforeTrigger: [],
			globalVariablesAfterResponse: [],
			actionsArray: [],
			templateInbound: '',
			templateOutbound: '',
			logDescription: '',
			beforeLogDescription: '',
			notificationEmailTitle: '',
			notificationEmail: '',
			disableInboundEmail: false,
			disableOutboundEmail: false,
			request_method: 'DEFAULT'
		};
	}

	renderActionsTable();

	if (triggerRulesJson[`row-${dataId}`] && triggerRulesJson[`row-${dataId}`].length > 0) {
		$('table.outbound-validation-rules-table tbody').empty();

		triggerRulesJson[`row-${dataId}`].forEach((rule, index) => {
			let newRow = `<tr>`;

			newRow += `<td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="validations[][logical]"><option value="AND" ${rule.logical === 'AND' ? 'selected' : ''}>AND</option><option value="OR" ${rule.logical === 'OR' ? 'selected' : ''}>OR</option></select></td>`;
			newRow += `<td class="col-sm-3 autocomplete"><input type="text" name="validations[][original]" class="form-control border-0 autocompletevalidation" id="validation-original-${index}" value="${rule.original.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"/></td>`;
			newRow += `<td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="validations[][operations]"><option value="==" ${rule.operations === '==' ? 'selected' : ''}>=</option><option value=">" ${rule.operations === '>' ? 'selected' : ''}>></option><option value=">=" ${rule.operations === '>=' ? 'selected' : ''}>>=</option><option value="<" ${rule.operations === '<' ? 'selected' : ''}><</option><option value="<=" ${rule.operations === '<=' ? 'selected' : ''}><=</option><option value="<>" ${rule.operations === '<>' ? 'selected' : ''}><></option><option value="Contains" ${rule.operations === 'Contains' ? 'selected' : ''}>Contains</option></select></td>`;
			newRow += `<td class="col-sm-2 autocomplete"><input type="text" name="validations[][column]" class="form-control border-0 autocompletevalidation" id="validation-column-${index}" value="${rule.column.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"/></td>`;
			newRow += `<td class="col-sm-2"><select class="select-dropdown form-control form-control-lg format-then-name" name="validations[][then]"><option value="SKIP" ${rule.then === 'SKIP' ? 'selected' : ''}>SKIP</option><option value="STOP" ${rule.then === 'STOP' ? 'selected' : ''}>STOP</option></select></td>`;
			newRow += `<td class="col-sm-2 autocomplete outbound-validation-rules-table-row-formula"><input type="text" name="validations[][formula]" class="form-control border-0 autocompletevalidation" id="validation-validformula-${index}" value="${rule.formula.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"/></td>`;
			newRow += `<td class="col-sm-2 text-center"><a href="javascript:void(0);" type="button" class="outbound-validation-rules-btn-del btn btn-lg btn-del"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>`;
			newRow += `</tr>`;

			$('table.outbound-validation-rules-table tbody').append(newRow);
		});
	} else {
		$('table.outbound-validation-rules-table tbody').empty();
		addRowToOutBoundValidaitonRow();
	}

	if (specifyHeaderJson[`row-${dataId}`].headers && specifyHeaderJson[`row-${dataId}`].headers.length > 0) {
		$('table.outbound-specify-headers-table tbody').empty();

		specifyHeaderJson[`row-${dataId}`].headers.forEach((header, index) => {
			let newRow = `<tr>`;
			newRow += '<td class="format-rules-icon text-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-code font-medium-2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></td>';
			newRow += `<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound-specify-headers-status" id="outbound-specify-headers-status-${index}" class="custom-control-input" ${header.status ? 'checked' : ''} /><label class="custom-control-label" for="outbound-specify-headers-status-${index}"></label></div></td>`;
			newRow += `<td class="col-sm-3"><input type="text" name="outbound-specify-headers[][key]" class="form-control border-0" id="outbound-specify-headers-key-${index}" value="${header.key}" /></td>`;
			newRow += `<td class="col-sm-4"><input type="text" name="outbound-specify-headers[][value]" class="form-control border-0" id="outbound-specify-headers-value-${index}" value="${header.value.replace(/"/g, '&quot;')}" /></td>`;
			newRow += `<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound-specify-headers-mask-status" id="outbound-specify-headers-mask-status-${index}" class="custom-control-input" ${header.mask ? 'checked' : ''} /><label class="custom-control-label" for="outbound-specify-headers-mask-status-${index}"></label></div></td>`;
			newRow += `<td class="col-sm-3"><input type="text" name="outbound-specify-headers[][description]" class="form-control border-0" id="outbound-specify-headers-description-${index}" value="${header.description}" /></td>`;
			newRow += `<td class="col-sm-1 text-center"><a href="javascript:void(0);" type="button" class="outbound-specify-headers-btn-del btn btn-lg btn-del modal-button"><i data-feather="minus" class="font-medium-2"></i></a></td>`;
			newRow += `</tr>`;

			$('table.outbound-specify-headers-table tbody').append(newRow);
		});
		feather.replace({ width: 14, height: 14 });
	} else {
		$('table.outbound-specify-headers-table tbody').empty();
		addRowToSpecifyHeaderRow();
	}

	if (specifyHeaderJson[`row-${dataId}`].globalVariablesBeforeTrigger && specifyHeaderJson[`row-${dataId}`].globalVariablesBeforeTrigger.length > 0) {
		$('table.outbound-global-variables-before-outbound-trigger-table tbody').empty();

		specifyHeaderJson[`row-${dataId}`].globalVariablesBeforeTrigger.forEach((header, index) => {
			let newRow = `<tr>`;
			newRow += '<td class="format-rules-icon text-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-code font-medium-2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></td>';
			newRow += `<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound-global-variables-before-outbound-trigger-status" id="outbound-global-variables-before-outbound-trigger-status-${index}" class="custom-control-input" ${header.status ? 'checked' : ''} /><label class="custom-control-label" for="outbound-global-variables-before-outbound-trigger-status-${index}"></label></div></td>`;
			newRow += `<td class="col-sm-3"><input type="text" name="outbound-global-variables-before-outbound-trigger[][key]" class="form-control border-0" id="outbound-global-variables-before-outbound-trigger-key-${index}" value="${header.key}" /></td>`;
			newRow += `<td class="col-sm-4"><input type="text" name="outbound-global-variables-before-outbound-trigger[][value]" class="form-control border-0" id="outbound-global-variables-before-outbound-trigger-value-${index}" value="${header.value.replace(/"/g, '&quot;')}" /></td>`;
			newRow += `<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound-global-variables-before-outbound-trigger-mask-status" id="outbound-global-variables-before-outbound-trigger-mask-status-${index}" class="custom-control-input" ${header.mask ? 'checked' : ''} /><label class="custom-control-label" for="outbound-global-variables-before-outbound-trigger-mask-status-${index}"></label></div></td>`;
			newRow += `<td class="col-sm-3"><input type="text" name="outbound-global-variables-before-outbound-trigger[][description]" class="form-control border-0" id="outbound-global-variables-before-outbound-trigger-description-${index}" value="${header.description}" /></td>`;
			newRow += `<td class="col-sm-1 text-center"><a href="javascript:void(0);" type="button" class="outbound-global-variables-before-outbound-trigger-btn-del btn btn-lg btn-del modal-button"><i data-feather="minus" class="font-medium-2"></i></a></td>`;
			newRow += `</tr>`;

			$('table.outbound-global-variables-before-outbound-trigger-table tbody').append(newRow);
		});
		feather.replace({ width: 14, height: 14 });
	} else {
		$('table.outbound-global-variables-before-outbound-trigger-table tbody').empty();
		addRowToOutboundGlobalVariablesBeforeTrigger();
	}

	if (specifyHeaderJson[`row-${dataId}`].globalVariablesAfterResponse && specifyHeaderJson[`row-${dataId}`].globalVariablesAfterResponse.length > 0) {
		$('table.outbound-global-variables-after-response-table tbody').empty();

		specifyHeaderJson[`row-${dataId}`].globalVariablesAfterResponse.forEach((header, index) => {
			let newRow = `<tr>`;
			newRow += '<td class="format-rules-icon text-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-code font-medium-2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></td>';
			newRow += `<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound-global-variables-after-response-status" id="outbound-global-variables-after-response-status-${index}" class="custom-control-input" ${header.status ? 'checked' : ''} /><label class="custom-control-label" for="outbound-global-variables-after-response-status-${index}"></label></div></td>`;
			newRow += `<td class="col-sm-3"><input type="text" name="outbound-global-variables-after-response[][key]" class="form-control border-0" id="outbound-global-variables-after-response-key-${index}" value="${header.key}" /></td>`;
			newRow += `<td class="col-sm-4"><input type="text" name="outbound-global-variables-after-response[][value]" class="form-control border-0" id="outbound-global-variables-after-response-value-${index}" value="${header.value.replace(/"/g, '&quot;')}" /></td>`;
			newRow += `<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound-global-variables-after-response-mask-status" id="outbound-global-variables-after-response-mask-status-${index}" class="custom-control-input" ${header.mask ? 'checked' : ''} /><label class="custom-control-label" for="outbound-global-variables-after-response-mask-status-${index}"></label></div></td>`;
			newRow += `<td class="col-sm-3"><input type="text" name="outbound-global-variables-after-response[][description]" class="form-control border-0" id="outbound-global-variables-after-response-description-${index}" value="${header.description}" /></td>`;
			newRow += `<td class="col-sm-1 text-center"><a href="javascript:void(0);" type="button" class="outbound-global-variables-after-response-btn-del btn btn-lg btn-del modal-button"><i data-feather="minus" class="font-medium-2"></i></a></td>`;
			newRow += `</tr>`;

			$('table.outbound-global-variables-after-response-table tbody').append(newRow);
		});
		feather.replace({ width: 14, height: 14 });
	} else {
		$('table.outbound-global-variables-after-response-table tbody').empty();
		addRowToOutboundGlobalVariablesAfterResponse();
	}

	$('#templateInbound').val(specifyHeaderJson[`row-${dataId}`].templateInbound || ''),
	$('#templateOutbound').val(specifyHeaderJson[`row-${dataId}`].templateOutbound || ''),
	$('#logDescription').val(specifyHeaderJson[`row-${dataId}`].logDescription || '');
	$('#beforeLogDescription').val(specifyHeaderJson[`row-${dataId}`].beforeLogDescription || '');
	$('#notificationEmailTitle').val(specifyHeaderJson[`row-${dataId}`].notificationEmailTitle || '');
	$('#notificationEmail').val(specifyHeaderJson[`row-${dataId}`].notificationEmail || '');
	$('#disableInboundEmail').prop('checked', !!specifyHeaderJson[`row-${dataId}`].disableInboundEmail);
	$('#disableOutboundEmail').prop('checked', !!specifyHeaderJson[`row-${dataId}`].disableOutboundEmail);
	$('#select-http-type').val(specifyHeaderJson[`row-${dataId}`].request_method || 'DEFAULT').trigger('change');
});

$('body').on('click', '#outbound-specify-headers-modal-close', function () {
	$('#outbound-specify-headers-modal').modal('hide');
});

$('body').on('click', '#outbound-specify-headers-btn-add-row', function () {
	addRowToSpecifyHeaderRow();
});

function addRowToSpecifyHeaderRow() {
	let newRow = '<tr>';
	let cols = '';
	cols += '<td class="format-rules-icon text-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-code font-medium-2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></td>';
	cols += `<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"> <input type="checkbox" name="outbound-specify-headers-status" id="outbound-specify-headers-status-${specifyHeaderCounter}" class="custom-control-input" checked /> <label class="custom-control-label" for="outbound-specify-headers-status-${specifyHeaderCounter}"></label></div></td>`;
	cols += ` <td class="col-sm-3"><input type="text" name="outbound-specify-headers[][key]" class="form-control border-0" id="outbound-specify-headers-key-${specifyHeaderCounter}" /></td>`;
	cols += `<td class="col-sm-4"><input type="text" name="outbound-specify-headers[][value]" class="form-control border-0" id="outbound-specify-headers-value-${specifyHeaderCounter}" /></td>`;
	cols += `<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"> <input type="checkbox" name="outbound-specify-headers-mask-status" id="outbound-specify-headers-mask-status-${specifyHeaderCounter}" class="custom-control-input" checked /> <label class="custom-control-label" for="outbound-specify-headers-mask-status-${specifyHeaderCounter}"></label></div></td>`;
	cols += `<td class="col-sm-3"><input type="text" name="outbound-specify-headers[][description]" class="form-control border-0" id="outbound-specify-headers-description-${specifyHeaderCounter}" /></td>`;
	cols += `<td class="col-sm-1 text-center"><a href="javascript:void(0);" type="button" class="outbound-specify-headers-btn-del btn btn-lg btn-del modal-button">
	<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>`;

	newRow += cols;
	newRow += '</tr>';

	$('table.outbound-specify-headers-table tbody').append(newRow);

	specifyHeaderCounter++;
}

$('body').on('click', '.outbound-specify-headers-btn-del', function () {
	$(this).closest('tr').remove();
});

$('body').on('click', '#outbound-global-variables-before-outbound-trigger-btn-add-row', function () {
	addRowToOutboundGlobalVariablesBeforeTrigger();
});

function addRowToOutboundGlobalVariablesBeforeTrigger() {
	let newRow = '<tr>';
	let cols = '';
	cols += '<td class="format-rules-icon text-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-code font-medium-2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></td>';
	cols += `<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"> <input type="checkbox" name="outbound-global-variables-before-outbound-trigger-status" id="outbound-global-variables-before-outbound-trigger-status-${outboundGlobalVariablesBeforeTriggerCounter}" class="custom-control-input" checked/> <label class="custom-control-label" for="outbound-global-variables-before-outbound-trigger-status-${outboundGlobalVariablesBeforeTriggerCounter}"></label></div></td>`;
	cols += ` <td class="col-sm-3"><input type="text" name="outbound-global-variables-before-outbound-trigger[][key]" class="form-control border-0" id="outbound-global-variables-before-outbound-trigger-key-${outboundGlobalVariablesBeforeTriggerCounter}" /></td>`;
	cols += `<td class="col-sm-4"><input type="text" name="outbound-global-variables-before-outbound-trigger[][value]" class="form-control border-0" id="outbound-global-variables-before-outbound-trigger-value-${outboundGlobalVariablesBeforeTriggerCounter}" /></td>`;
	cols += `<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"> <input type="checkbox" name="outbound-global-variables-before-outbound-trigger-mask-status" id="outbound-global-variables-before-outbound-trigger-mask-status-${outboundGlobalVariablesBeforeTriggerCounter}" class="custom-control-input" checked /> <label class="custom-control-label" for="outbound-global-variables-before-outbound-trigger-mask-status-${outboundGlobalVariablesBeforeTriggerCounter}"></label></div></td>`;
	cols += `<td class="col-sm-3"><input type="text" name="outbound-global-variables-before-outbound-trigger[][description]" class="form-control border-0" id="outbound-global-variables-before-outbound-trigger-description-${outboundGlobalVariablesBeforeTriggerCounter}" /></td>`;
	cols += `<td class="col-sm-1 text-center"><a href="javascript:void(0);" type="button" class="outbound-global-variables-before-outbound-trigger-btn-del btn btn-lg btn-del modal-button">
	<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>`;

	newRow += cols;
	newRow += '</tr>';

	$('table.outbound-global-variables-before-outbound-trigger-table tbody').append(newRow);

	outboundGlobalVariablesBeforeTriggerCounter++;
}

$('body').on('click', '.outbound-global-variables-before-outbound-trigger-btn-del', function () {
	$(this).closest('tr').remove();
});

$('body').on('click', '#outbound-global-variables-after-response-btn-add-row', function () {
	addRowToOutboundGlobalVariablesAfterResponse();
});

function addRowToOutboundGlobalVariablesAfterResponse() {
	let newRow = '<tr>';
	let cols = '';
	cols += '<td class="format-rules-icon text-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-code font-medium-2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></td>';
	cols += `<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"> <input type="checkbox" name="outbound-global-variables-after-response-status" id="outbound-global-variables-after-response-status-${outboundGlobalVariablesAfterResponseCounter}" class="custom-control-input" checked/> <label class="custom-control-label" for="outbound-global-variables-after-response-status-${outboundGlobalVariablesAfterResponseCounter}"></label></div></td>`;
	cols += ` <td class="col-sm-3"><input type="text" name="outbound-global-variables-after-response[][key]" class="form-control border-0" id="outbound-global-variables-after-response-key-${outboundGlobalVariablesAfterResponseCounter}" /></td>`;
	cols += `<td class="col-sm-4"><input type="text" name="outbound-global-variables-after-response[][value]" class="form-control border-0" id="outbound-global-variables-after-response-value-${outboundGlobalVariablesAfterResponseCounter}" /></td>`;
	cols += `<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"> <input type="checkbox" name="outbound-global-variables-after-response-mask-status" id="outbound-global-variables-after-response-mask-status-${outboundGlobalVariablesAfterResponseCounter}" class="custom-control-input" checked /> <label class="custom-control-label" for="outbound-global-variables-after-response-mask-status-${outboundGlobalVariablesAfterResponseCounter}"></label></div></td>`;
	cols += `<td class="col-sm-3"><input type="text" name="outbound-global-variables-after-response[][description]" class="form-control border-0" id="outbound-global-variables-after-response-description-${outboundGlobalVariablesAfterResponseCounter}" /></td>`;
	cols += `<td class="col-sm-1 text-center"><a href="javascript:void(0);" type="button" class="outbound-global-variables-after-response-btn-del btn btn-lg btn-del modal-button">
	<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>`;

	newRow += cols;
	newRow += '</tr>';

	$('table.outbound-global-variables-after-response-table tbody').append(newRow);

	outboundGlobalVariablesAfterResponseCounter++;
}

$('body').on('click', '.outbound-global-variables-after-response-btn-del', function () {
	$(this).closest('tr').remove();
});

$('body').on('click', '#outbound-specify-headers-save', function (event) {
	event.preventDefault();
	$('.overlay, body').removeClass('loaded');
	$('.overlay').css({ 'display': 'block' });

	const rowId = $('#outbound-specify-headers-id').val();
	let headersDataArr = [];
	let triggerRulesDataArr = [];
	let globalVariablesBeforeTriggerDataArr = [];
	let globalVariablesAfterResponseDataArr = [];

	$('#outbound-specify-headers-table').find('tbody tr').each(function () {
		let headerDataObj = {};
		let $row = $(this);

		headerDataObj.status = $('input[name="outbound-specify-headers-status"]', $row).is(':checked');
		headerDataObj.key = $('input:text:eq(0)', $row).val();
		headerDataObj.value = $('input:text:eq(1)', $row).val();
		headerDataObj.mask = $('input[name="outbound-specify-headers-mask-status"]', $row).is(':checked');
		headerDataObj.description = $('input:text:eq(2)', $row).val();

		if (headerDataObj.key && headerDataObj.value) {
			headersDataArr.push(headerDataObj);
		}
	});

	$('#outbound-global-variables-before-outbound-trigger-table').find('tbody tr').each(function () {
		let headerDataObj = {};
		let $row = $(this);

		headerDataObj.status = $('input[name="outbound-global-variables-before-outbound-trigger-status"]', $row).is(':checked');
		headerDataObj.key = $('input:text:eq(0)', $row).val();
		headerDataObj.value = $('input:text:eq(1)', $row).val();
		headerDataObj.mask = $('input[name="outbound-global-variables-before-outbound-trigger-mask-status"]', $row).is(':checked');
		headerDataObj.description = $('input:text:eq(2)', $row).val();

		if (headerDataObj.key && headerDataObj.value) {
			globalVariablesBeforeTriggerDataArr.push(headerDataObj);
		}
	});

	$('#outbound-global-variables-after-response-table').find('tbody tr').each(function () {
		let headerDataObj = {};
		let $row = $(this);

		headerDataObj.status = $('input[name="outbound-global-variables-after-response-status"]', $row).is(':checked');
		headerDataObj.key = $('input:text:eq(0)', $row).val();
		headerDataObj.value = $('input:text:eq(1)', $row).val();
		headerDataObj.mask = $('input[name="outbound-global-variables-after-response-mask-status"]', $row).is(':checked');
		headerDataObj.description = $('input:text:eq(2)', $row).val();

		if (headerDataObj.key && headerDataObj.value) {
			globalVariablesAfterResponseDataArr.push(headerDataObj);
		}
	});

	$('#outbound-validation-rules-table').find('tbody tr').each(function () {
		let formDataObj = {};
		let $fieldset = $(this);

		formDataObj.logical = $('select:eq(0) option:selected', $fieldset).val();
		formDataObj.original = $('input:text:eq(0)', $fieldset).val();
		formDataObj.operations = $('select:eq(1) option:selected', $fieldset).val();
		formDataObj.column = $('input:text:eq(1)', $fieldset).val();
		formDataObj.then = $('select:eq(2) option:selected', $fieldset).val();
		formDataObj.formula = $('input:text:eq(2)', $fieldset).val();

		if (formDataObj.logical && formDataObj.column) {
			triggerRulesDataArr.push(formDataObj);
		}
	});

	const templateInbound = $('#templateInbound').val();
	const templateOutbound = $('#templateOutbound').val();
	const logDescription = $('#logDescription').val();
	const beforeLogDescription = $('#beforeLogDescription').val();
	const notificationEmailTitle = $('#notificationEmailTitle').val();
	const notificationEmail = $('#notificationEmail').val();
	const disableInboundEmail = $('#disableInboundEmail').prop('checked');
	const disableOutboundEmail = $('#disableOutboundEmail').prop('checked');
	const request_method = $('#select-http-type').val();

	if (triggerRulesDataArr.length <= 0) {
		triggerRulesDataArr = '';
	}

	if (triggerRulesDataArr.length > 0) {
		triggerRulesJson[`row-${rowId}`] = triggerRulesDataArr;
	} else {
		delete triggerRulesJson[`row-${rowId}`];
	}

	if (headersDataArr.length > 0 || logDescription || beforeLogDescription || notificationEmailTitle || request_method || notificationEmail || templateInbound || templateOutbound) {
		specifyHeaderJson[`row-${rowId}`] = {
			headers: headersDataArr,
			globalVariablesBeforeTrigger: globalVariablesBeforeTriggerDataArr,
			globalVariablesAfterResponse: globalVariablesAfterResponseDataArr,
			actionsArray: specifyHeaderJson[`row-${rowId}`].actionsArray || [],
			templateInbound: templateInbound || '',
			templateOutbound: templateOutbound || '',
			logDescription: logDescription || '',
			beforeLogDescription: beforeLogDescription || '',
			notificationEmailTitle: notificationEmailTitle || '',
			notificationEmail: notificationEmail || '',
			disableInboundEmail: disableInboundEmail || false,
			disableOutboundEmail: disableOutboundEmail || false,
			request_method: request_method || 'DEFAULT',
		};
	} else {
		delete specifyHeaderJson[`row-${rowId}`];
	}

	$('.overlay, body').addClass('loaded');
	$('.overlay').css({ 'display': 'none' });

	$('#outbound-specify-headers-modal').modal('hide');
});

async function createParty(rowCounter) {
	isPartyPage = false;
	$('#select-party-' + rowCounter).select2('close');
	clearFormFieldsParty();
	const companyId = $('#select-item-company').val();
	const projectId = $('#select-item-project').val();

	const $selectCompany = $('#select-party-company');
	$selectCompany.data('programmaticChange', true);
	$selectCompany.data('project_id', projectId);
	$selectCompany.val(companyId).trigger('change.select2');
	setTimeout(() => {
		$selectCompany.data('programmaticChange', false);
	}, 10);

	await partyProject(companyId, projectId);
	await partyEnvironment(companyId, projectId);

	$('#party-modal-slide-in').modal('show');
}

async function updatePartyOptions() {
	const selectedProject = $('#select-item-project').val();
	const selectedEnvironment = $('#select-item-environment').val();
	await fetchParties(selectedProject, selectedEnvironment);

	$('#outbound-endpoint-data-table').find('tbody tr').each(function (index) {
		let $selectParty = $('#select-party-' + index);
		let currentValue = $selectParty.val();

		$selectParty.empty();
		$selectParty.wrap('<div class="position-relative"></div>').select2({
			data: partiesOptionsGlobal,
			width: '100%',
			placeholder: '-- Please Select --',
			dropdownParent: $selectParty.parent()
		});

		$selectParty.val(currentValue).trigger('change');
	});

	$('#party-modal-slide-in').modal('hide');
}

async function editPartyData(partyData) {
	isPartyPage = false;
	clearFormFieldsParty();
	partyId = partyData.id;
	if (partyId) {
		$('#party-id').val(partyId);
		$('#party-modal-label').text('Update Party');
		$('#create-party').text('Update Party');
		editParty(partyId)
			.then(response => { })
			.catch(error => {
				Swal.fire({
					title: 'Error!',
					text: error,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			});
	}
	$('#party-modal-slide-in').modal('show');
}

async function updateMappingProfileOption(mappingProfileId, mappingProfileHistoryId) {
	const selectedProject = $('#select-item-project').val();
	const selectedCompany = $('#select-item-company').val();
	let defaultInboundMappingValue = $('#select-inbound-default-mapping').find('option:selected');
	let defaultOutboundMappingValue = $('#select-outbound-default-mapping').find('option:selected');
	await fetchMappings(selectedCompany, selectedProject);

	$('#outbound-endpoint-data-table').find('tbody tr').each(function (index) {
		const $selectInbound = $(`#select-inbound-mapping-${index}`);
		const $selectOutbound = $(`#select-outbound-mapping-${index}`);
		const currentValueInbound = $selectInbound.val();
		const currentValueOutbound = $selectOutbound.val();

		$selectInbound.empty().select2({
			data: [{ id: ' ', text: 'Default' }, ...boundOptionsGlobal],
			width: '100%',
			placeholder: '-- Please Select --',
		}).val(currentValueInbound).trigger('change');

		$selectOutbound.empty().select2({
			data: [{ id: ' ', text: 'Default' }, ...boundOptionsGlobal],
			width: '100%',
			placeholder: '-- Please Select --',
		}).val(currentValueOutbound).trigger('change');

		if (mappingProfileId) {
			if (currentValueInbound === globalMappingId) {
				$selectInbound.val(globalMappingId).trigger('change');
			}
			if (currentValueOutbound === globalMappingId) {
				$selectOutbound.val(globalMappingId).trigger('change');
			}
		}
	});

	const defaultInboundMapping = $('#select-inbound-default-mapping');
	const defaultOutboundMapping = $('#select-outbound-default-mapping');

	if (!defaultInboundMapping.length || !defaultOutboundMapping.length) {
		console.error('Default mapping elements not found');
		return;
	}

	defaultInboundMapping.select2({
		data: [...boundOptionsGlobal],
		width: '100%',
		placeholder: '-- Please Select --',
	});

	defaultOutboundMapping.select2({
		data: [...boundOptionsGlobal],
		width: '100%',
		placeholder: '-- Please Select --',
	});

	if (defaultInboundMappingValue.val() === globalMappingId) {
		defaultInboundMapping.val(globalMappingId).trigger('change');
	} else {
		defaultInboundMapping.val(defaultInboundMappingValue.val()).trigger('change');
	}
	if (defaultOutboundMappingValue.val() === globalMappingId) {
		defaultOutboundMapping.val(globalMappingId).trigger('change');
	} else {
		defaultOutboundMapping.val(defaultOutboundMappingValue.val()).trigger('change');
	}

	globalMappingId = '';
	$('#mapping-profile-modal-slide-in').modal('hide');
}

async function createMappingProfile(rowCounter) {
	mappingHistoryData = [];
	isMappingProfilePage = false;
	itemProperties = [];
	currentItemProperty = {};
	currentItemPropertyEnable = 0;
	propsValidationRowCounter = 1;
	propsFormatRowCounter = 1;
	const selectedProjectValue = getCookie('selectedProject');
	$('#select-inbound-mapping-' + rowCounter).select2('close');
	$('#select-outbound-mapping-' + rowCounter).select2('close');
	$('#mapping-profile-id').val('');
	$('#mapping-profile-history-id').val('');
	$('#mapping-profile-name').val('');
	$('#version').val('');
	$('#mapping-profile-description').val('');
	if (selectedProjectValue) {
		$('#select-project').val(selectedProjectValue).trigger('change');
	}
	$('#return-url').val('');
	$('#send-collection-one-by-one').prop('checked', false);
	$('#collections-name').val('');
	$('#select-inbound-format').val('json').trigger('change');
	$('#select-outbound-format').val('json').trigger('change');
	$('#inboundFormatData').val('');
	$('#outboundFormatData').val('');
	$('#mapping-formula-props #props-display-value').val('');
	$('#mapping-formula-props #props-display-default-value').val('');
	$('#mapping-formula-props #props-display-global-variable-name').val('');

	$('#props-validation-is-required').val('FALSE').trigger('change');
	$('#props-validation-value-must-be').val("").trigger('change');

	$('#prop-validation-additional-rules-table tbody').html('');
	$('#prop-validation-additional-rules-btn-add-row').trigger('click');

	$('#props-format-is-trim').val('FALSE').trigger('change');
	$('#props-format-enable-rounding').val('FALSE').trigger('change');
	$('#props-format-enable-decimal').val('FALSE').trigger('change');

	$('#mapping-formula-props #props-format-decimal').val('2');

	$('#prop-format-additional-rules-table tbody').html('');
	$('#prop-format-additional-rules-btn-add-row').trigger('click');

	const htmlData = '<tr><td colspan="4">No Data</td></tr>';
	$('#publish-history tbody').html(htmlData);
	$('#version-history tbody').html(htmlData);

	myDiagram.model = new go.GraphLinksModel([], []);

	$('#filter-table tbody').empty();

	filterCounter = 0;

	let newRowFilterTable = '<tr>';
	let newColsFilterTable = '';

	newColsFilterTable += '<td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="filter[][logical]"><option value="AND">AND</option><option value="OR">OR</option></select></td>';
	newColsFilterTable += '<td class="col-sm-3 autocomplete"><input type="text" name="filter[][original]" class="form-control border-0 inboound-autocomplete-filter" id="filteroriginal_' + filterCounter + '"/></td>';
	newColsFilterTable += '<td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="filter[][operations]"><option value="==">=</option><option value=">">></option><option value=">=">>=</option><option value="<"><</option><option value="<="><=</option><option value="<>"><></option><option value="Contains">Contains</option></select></td>';
	newColsFilterTable += '<td class="col-sm-2 autocomplete"><input type="text" name="filter[][column]" class="form-control border-0 inboound-autocomplete-filter" id="filtercolumn_' + filterCounter + '"/></td>';
	newColsFilterTable += '<td class="col-sm-2 text-center"><a href="javascript:void(0);" type="button" class="filter-btn-del btn-del btn btn-lg modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';

	newRowFilterTable += newColsFilterTable;
	newRowFilterTable += '</tr>';

	$('#filter-table tbody').append(newRowFilterTable);

	filterCounter++;

	clearErrors();
	$('#mapping-profile-modal-slide-in').modal('show');
	$('#update-mapping-profile').hide();
}

function separateNodesAndLinks(nodeDataArray, linkDataArray) {
	inbound_nodes = nodeDataArray.filter(node => node.group === 'inbound' && !node.isGroup);
	outbound_nodes = nodeDataArray.filter(node => node.group === 'outbound' && !node.isGroup);

	inbound_linkdata = linkDataArray.filter(link => {
		const fromNode = nodeDataArray.find(n => n.key === link.from);
		const toNode = nodeDataArray.find(n => n.key === link.to);
		return fromNode?.group === 'inbound' && toNode?.group === 'inbound';
	});

	outbound_linkdata = linkDataArray.filter(link => {
		const fromNode = nodeDataArray.find(n => n.key === link.from);
		const toNode = nodeDataArray.find(n => n.key === link.to);
		return fromNode?.group === 'outbound' && toNode?.group === 'outbound';
	});
}

async function editMappingProfileData(mappingData) {
	mappingHistoryData = [];
	isMappingProfilePage = false;
	itemProperties = [];
	currentItemProperty = {},
		currentItemPropertyEnable = 0,
		propsValidationRowCounter = 1,
		propsFormatRowCounter = 1;

	myDiagram.model = new go.GraphLinksModel([], []);
	myDiagram.clear();
	nodeDataArray = [];
	linkDataArray = [];
	inbound_nodes = [];
	inbound_linkdata = [];
	outbound_nodes = [];
	outbound_linkdata = [];

	$('#mapping-formula-props #props-display-value').val('');
	$('#mapping-formula-props #props-display-default-value').val('');
	$('#mapping-formula-props #props-display-global-variable-name').val('');
	$('#mapping-formula-props #props-general-item').html('');
	$('#mapping-formula-props .table-section-linked-items-rows').remove();

	$('#props-validation-is-required').val('FALSE').trigger('change');
	$('#props-validation-value-must-be').val("").trigger('change');

	$('#props-format-is-trim').val('FALSE').trigger('change');
	$('#props-format-enable-rounding').val('FALSE').trigger('change');
	$('#props-format-enable-decimal').val('FALSE').trigger('change');

	$('#prop-validation-additional-rules-table tbody').html('');
	$('#prop-validation-additional-rules-btn-add-row').trigger('click');
	$('#mapping-formula-props #props-format-decimal').val('2');

	$('#prop-format-additional-rules-table tbody').html('');
	$('#prop-format-additional-rules-btn-add-row').trigger('click');
	$('#inboundFormatData').val('');
	$('#outboundFormatData').val('');

	clearErrors();
	const mappingProfileId = mappingData.key;
	const version = mappingData.version;
	const mappingProfileHistoryId = await getMappingProfileHistoryId(mappingProfileId, version);
	mappingProfileHistory = mappingProfileHistoryId;

	if (mappingProfileHistoryId) {
		$('.overlay, body').removeClass('loaded');
		$('.overlay').css({ 'display': 'block' });

		await $.ajax({
			url: '/template/mapping-profiles/get/' + mappingProfileId + '/' + mappingProfileHistoryId,
			method: 'GET',
			success: async function (response) {
				if (response.status === 1) {
					const data = response?.data;
					const selectProject = $('#select-project');
					const selectInboundFormat = $('#select-inbound-format');
					const selectOutboundFormat = $('#select-outbound-format');

					$('#mapping-profile-id').val(data._id);
					$('#mapping-profile-history-id').val(mappingProfileHistoryId);
					$('#mapping-profile-name').val(data.name);
					$('#version').val(data?.version || '');
					$('#mapping-profile-description').val(data?.description || '');

					const selectCompany = $('#select-mapping-company');
					selectCompany.data('programmaticChange', true);
					selectCompany.val(data.companyId).trigger('change');

					await getProjectsMappingProfile(data.companyId, data.projectId);

					selectProject.val(data.projectId).trigger('change');

					$('#return-url').val(data?.returnUrl || '');

					if (data.sendCollectionOnebyOne) {
						$('#send-collection-one-by-one').prop('checked', true);
					} else {
						$('#send-collection-one-by-one').prop('checked', false);
					}

					$('#collections-name').val(data?.collectionsName || '');

					selectInboundFormat.val(data.inboundFormat || 'json').trigger('change');
					selectOutboundFormat.val(data.outboundFormat || 'json').trigger('change');

					$('#inboundFormatData').val(data?.inboundFormatData || '');
					$('#outboundFormatData').val(data?.outboundFormatData || '');

					if (data.filters.length > 0) {
						let htmlData = '';

						for (let i = 0; i < data.filters.length; i++) {
							let newRow = '<tr>';
							let newCols = '';

							newCols += '<td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="filter[][logical]">';
							newCols += '<option value="AND"';

							if (data.filters[i].logical == 'AND') {
								newCols += ' selected';
							}

							newCols += '>AND</option>';
							newCols += '<option value="OR"';

							if (data.filters[i].logical == 'OR') {
								newCols += ' selected';
							}

							newCols += '>OR</option>';
							newCols += '</select></td>';
							newCols += '<td class="col-sm-3 autocomplete"><input type="text" name="filter[][original]" class="form-control border-0 inboound-autocomplete-filter" id="filter-original-' + i + '" value="' + data.filters[i].original + '"/></td>';
							newCols += '<td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="filter[][operations]">';
							newCols += '<option value="=="';

							if (data.filters[i].operations == '==') {
								newCols += ' selected';
							}

							newCols += '>=</option>';
							newCols += '<option value=">"';

							if (data.filters[i].operations == '>') {
								newCols += ' selected';
							}

							newCols += '>></option>';
							newCols += '<option value=">="';

							if (data.filters[i].operations == '>=') {
								newCols += ' selected';
							}

							newCols += '>>=</option>';
							newCols += '<option value="<"';

							if (data.filters[i].operations == '<') {
								newCols += ' selected';
							}

							newCols += '><</option>';
							newCols += '<option value="<="';

							if (data.filters[i].operations == '<=') {
								newCols += ' selected';
							}

							newCols += '><=</option>';
							newCols += '<option value="<>"';

							if (data.filters[i].operations == '<>') {
								newCols += ' selected';
							}

							newCols += '><></option>';
							newCols += '<option value="Contains"';

							if (data.filters[i].operations == 'Contains') {
								newCols += ' selected';
							}

							newCols += '>Contains</option>';
							newCols += '</select></td>';
							newCols += '<td class="col-sm-2 autocomplete"><input type="text" name="filter[][column]" class="form-control border-0 inboound-autocomplete-filter" id="filter-column-' + i + '" value="' + data.filters[i].column + '"/></td>';

							newCols += '<td class="col-sm-2 text-center"><a href="javascript:void(0);" type="button" class="filter-btn-del btn btn-lg btn-del modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';

							newRow += newCols;
							newRow += '</tr>';
							htmlData += newRow;
							filterCounter = i + 1;
						}

						$('#filter-table tbody').html(htmlData);
					}

					if (data?.mappingData) {
						if (data.mappingData != '' && data.mappingData.nodeDataArray != undefined && data.mappingData.nodeDataArray.length > 0) {
							nodeDataArray = data.mappingData.nodeDataArray;
							linkDataArray = (data.mappingData.linkDataArray != undefined && data.mappingData.linkDataArray.length > 0) ? data.mappingData.linkDataArray : [];

							separateNodesAndLinks(nodeDataArray, linkDataArray);

							// Init GOJS UI
							myDiagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);

							previousLinkDataArray = JSON.parse(JSON.stringify(linkDataArray));
							previousNodeDataArray = JSON.parse(JSON.stringify(nodeDataArray));

							const inboundAutocompleteDataArrayReturn = inboundAutocompleteData(data.inboundFormatData);
							const outboundAutocompleteDataArrayReturn = outboundAutocompleteData(data.outboundFormatData);
							inOutAutocompleteDataArray = inboundAutocompleteDataArray.concat(outboundAutocompleteDataArray);
						}
					}

					itemProperties = data?.properties || [];

					if (data.isActive) {
						$('#is-active').prop('checked', true);
					} else {
						$('#is-active').prop('checked', false);
					}

					mappingProfileCompanyCode = data.companyCode;

					if (data.histories.length > 0) {
						mappingHistoryData = data;
					}

					$('#update-mapping-profile').show();
					$('#mapping-profile-modal-slide-in').modal('show');
				} else {
					Swal.fire({
						title: 'Error!',
						text: response.message,
						icon: 'error',
						customClass: {
							confirmButton: 'btn btn-primary'
						},
						buttonsStyling: false,
						timer: 1200
					});
				}

				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });
			},
			error: function (xhr, status, error) {
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });

				Swal.fire({
					title: 'Error!',
					text: xhr?.responseJSON?.message,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});

				return false;
			}
		});
	}
};

$('body').on('click', '#publish-history-button', function () {
	isMappingProfilePage = false
	if (Array.isArray(mappingHistoryData?.histories) && mappingHistoryData.histories.length > 0) {
		// Populate the history tables
		populateHistoryTable('#publish-history', mappingHistoryData, 'history', false);
		populateHistoryTable('#version-history', mappingHistoryData, 'version', true);
	}
	$('#publish-version-history-model-slide-in').modal('show')
});

function getMappingProfileHistoryId(mappingProfileId, version) {
	return new Promise((resolve, reject) => {
		$.ajax({
			url: '/template/mapping-profiles/get-mapping-profile-history',
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ mappingProfileId: mappingProfileId, version: version }),
			success: function (response) {
				if (response.status === 1) {
					resolve(response?.data?._id);
				} else {
					Swal.fire({
						title: 'Error!',
						text: response.message,
						icon: 'error',
						customClass: { confirmButton: 'btn btn-primary' },
						buttonsStyling: false,
						timer: 1200,
					});
					reject(new Error(response.message));
				}
			},
			error: function (xhr) {
				Swal.fire({
					title: 'Error!',
					text: xhr?.responseJSON?.message || 'Unknown error',
					icon: 'error',
					customClass: { confirmButton: 'btn btn-primary' },
					buttonsStyling: false,
					timer: 1200,
				});
				reject(new Error(xhr?.responseJSON?.message || 'Request failed'));
			}
		});
	});
}

$('body').on('click', '#refresh-logs-btn', function (event) {
	event.preventDefault(); // Prevent form submit or page reload
	const id = $('#item-id').val();
	if (id) {
		resLogTotalRecords = 0;
		$('#logs-data-table tbody').empty();
		if (logsTable) {
			logsTable.clear().draw();
		}
		const drp = $('#itemLogRange').data('daterangepicker');

		let start, end;
		if (drp && drp.startDate && drp.endDate) {
			const selectedLabel = $('#itemLogRange span').text();
			const minutes = timeOptions[selectedLabel]; // your predefined options map
			if (minutes) {
				// Dynamically calculate "last N minutes from now"
				start = moment().subtract(minutes, 'minutes');
				end = moment();
			} else {
				// Custom range selected, keep as-is
				start = drp.startDate.clone();
				end = drp.endDate.clone();
			}
		} else {
			// Default fallback
			start = moment().subtract(30, 'minutes');
			end = moment();
		}

		itemLogFromDate = start.toISOString();
		itemLogToDate = end.toISOString();
		getLogsData(logsPerPage, logsCurrentPage, id, itemLogFromDate, itemLogToDate);
	}
});

async function getLogsData(perPage, currentPage, searchItem, fromDate, toDate) {
	itemLogPage = true;
	$('.overlay, body').removeClass('loaded');
	$('.overlay').css({ 'display': 'block' });

	if (!logsTable) {
		logsTable.clear();
		logsTable.destroy();
		logsTable = $('#logs-data-table').DataTable({
			order: [[8, 'desc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			aoColumns: [
				null,
				null,
				null,
				null,
				null,
				{ width: "200px" },
				null,
				null,
				null,
				null,
				null,
				null
			],
		});
	} else {
		logsTable.clear().draw();
	}

	itemLogFromDate = fromDate;
	itemLogToDate = toDate;

	$('#logs-data-table tbody').empty();
	const columnCount = $('#logs-data-table thead th').length;

	$('#logs-data-table tbody').html(`<tr class="odd"><td valign="top" colspan="${columnCount}" class="dataTables_empty"><div class="tableloader"></div></td></tr>`);
	await logListApi(currentPage, perPage, type = "log", searchItem, fromDate, toDate)
	$('#item-logs-modal-slide-in').modal('show');
}

async function logListApi(currentPage, perPage, type = "log", searchItem, fromDate, toDate) {
	$('#logs-data-table tbody').empty();
	if (logsTable) {
		logsTable.clear().draw();
	}

	if (!logsTable) {
		logsTable = $('#logs-data-table').DataTable({
			order: [[8, 'desc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			aoColumns: [
				null,
				null,
				null,
				null,
				null,
				{ width: "200px" },
				null,
				null,
				null,
				null,
				null,
				null
			],
		});
	}
	await $.ajax({
		url: '/logs/logGroupFullList',
		method: 'POST',
		contentType: 'application/json',
		data: JSON.stringify({ page: parseInt(currentPage), limit: parseInt(perPage), type, searchItem, fromDate, toDate }),
		success: function (response) {
			let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
			resLogTotalRecords = parseInt(response.total);
			let totalRecord = parseInt(response.total);

			if (response.data.length <= 0) {
				$('#logs-data-table tbody').html('<tr class="odd"><td valign="top" colspan="11" class="dataTables_empty">No data available in table</td></tr>');
			}

			$.each(response.data, function (index, data) {
				const startDate = new Date(data.createdAt);
				const startYear = startDate.getFullYear();
				const startMonth = startDate.getMonth() + 1;
				const startDay = startDate.getDate();
				const startHours = (startDate.getHours() < 10 ? '0' : '') + startDate.getHours();
				const startMinutes = (startDate.getMinutes() < 10 ? '0' : '') + startDate.getMinutes();
				const startSeconds = (startDate.getSeconds() < 10 ? '0' : '') + startDate.getSeconds();
				const startMilliseconds = (startDate.getMilliseconds() < 10 ? '00' : (startDate.getMilliseconds() < 100 ? '0' : '')) + startDate.getMilliseconds();
				const startTime = startYear + '-' + (startMonth < 10 ? '0' : '') + startMonth + '-' + (startDay < 10 ? '0' : '') + startDay + ' ' + startHours + ':' + startMinutes + ':' + startSeconds + '.' + startMilliseconds;

				const endDateTime = (data?.last_end_log_history?.createdAt) ? data?.last_end_log_history?.createdAt : data?.last_log_history?.createdAt;
				const endDate = new Date(endDateTime);
				const endYear = endDate.getFullYear();
				const endMonth = endDate.getMonth() + 1;
				const endDay = endDate.getDate();
				const endHours = (endDate.getHours() < 10 ? '0' : '') + endDate.getHours();
				const endMinutes = (endDate.getMinutes() < 10 ? '0' : '') + endDate.getMinutes();
				const endSeconds = (endDate.getSeconds() < 10 ? '0' : '') + endDate.getSeconds();
				const endMilliseconds = (endDate.getMilliseconds() < 10 ? '00' : (endDate.getMilliseconds() < 100 ? '0' : '')) + endDate.getMilliseconds();
				const endTime = endYear + '-' + (endMonth < 10 ? '0' : '') + endMonth + '-' + (endDay < 10 ? '0' : '') + endDay + ' ' + endHours + ':' + endMinutes + ':' + endSeconds + '.' + endMilliseconds;

				const differenceInMilliseconds = new Date(endTime) - new Date(startTime);

				const logDescriptionText = (data?.log_description?.datas || '').replace(/\n/g, '<br>');

				const safeLogDescription = logDescriptionText
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#39;');

				// Apply underline class only if description exists
				const clickableLogDescription = `<span class="${safeLogDescription ? 'clickable-item-name' : ''}" data-item-id="${data?.item_id}" data-unique-id="${data.unique_id}" data-type="${data.type}" data-log-description="${safeLogDescription}" onclick="openItemLogDescriptionModal(this)">${logDescriptionText}</span>`;

				let $button_group = '<div class="btn-group" role="group" aria-label="Basic example">';
				$button_group += '<button type="button" class="btn btn-outline-secondary view-item-logs-modal" data-toggle="tooltip" title="View" data-id="' + data.unique_id + '" data-type="' + data.type + '"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>';
				$button_group += '</div>';

				let httpStatus = data.all_log_httpstatus.length > 0 ? data.all_log_httpstatus[0].httpStatus : ''

				logsTable.row.add([
					counter++,
					data?.item_details?.ItemName || '',
					data.unique_id,
					data.type,
					data.path,
					clickableLogDescription,
					data?.last_end_log_history?.description || data?.last_log_history?.description,
					httpStatus || '',
					startTime,
					endTime,
					differenceInMilliseconds,
					$button_group
				]).draw(false);
			});

			logsPagination(perPage, currentPage, totalRecord)

			$('.overlay, body').addClass('loaded');
			$('.overlay').css({ 'display': 'none' });
		},
		error: function (xhr, status, error) {
			$('.overlay, body').addClass('loaded');
			$('.overlay').css({ 'display': 'none' });

			Swal.fire({
				title: 'Error!',
				text: xhr?.responseJSON?.message,
				icon: 'error',
				customClass: {
					confirmButton: 'btn btn-primary'
				},
				buttonsStyling: false,
				timer: 1200
			});

			return false;
		}
	});
}

async function openItemLogDescriptionModal(element) {
	const $element = $(element);
	const itemId = $element.data('item-id') || '';
	const unique_id = $element.data('unique-id') || '';
	const log_description = $element.data('log-description') || '';
	const plainDescription = log_description
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/<br\s*\/?>/gi, '\r\n');

	if (!itemId && !unique_id) return;
	$('#log-description-value').val(plainDescription);
	$('#log-unique-id').val(unique_id);
	$('#log-description-modal-slide-in').modal('show');
}

async function logsPagination(perPage, currentPage, totalRecord) {
	$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
	let startEntry = (parseInt(currentPage) == 1) ? 1 : ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1);
	let endEntry = (parseInt(currentPage) == 1) ? parseInt(perPage) : (parseInt(perPage) * parseInt(currentPage));
	endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

	if (totalRecord == 0) {
		startEntry = 0;
	}

	const showpage = `Showing ${startEntry} to ${endEntry} of ${totalRecord} entries`;
	$('body').find('#logs-data-table_info').html(showpage);

	let dataDtIdx = 0;
	let paginationHtml = '';
	let firstDisable = (parseInt(currentPage) == 1) ? 'disabled' : '';
	let lastDisable = (parseInt(currentPage) == Math.ceil(totalRecord / parseInt(perPage))) ? 'disabled' : '';

	if (Math.ceil(totalRecord / parseInt(perPage)) > 0) {
		paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="logs-data-table_first_1" data-pageno="1">First</a>';
		dataDtIdx++;
		paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="logs-data-table_previous_1" data-pageno="' + (parseInt(currentPage) - 1) + '">Previous</a>';
		paginationHtml += '<span>';
		dataDtIdx++;

		if (parseInt(currentPage) > 2) {
			paginationHtml += '<a class="paginate_button" aria-controls="logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
			if (parseInt(currentPage) > 3) {
				paginationHtml += '<span class="ellipsis">...</span>';
			}
			dataDtIdx++;
		}

		if ((parseInt(currentPage) - 1) > 0) {
			paginationHtml += '<a class="paginate_button" aria-controls="logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) - 1) + '">' + (parseInt(currentPage) - 1) + '</a>';
			dataDtIdx++;
		}

		paginationHtml += '<a class="paginate_button current" aria-controls="logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(currentPage) + '">' + parseInt(currentPage) + '</a>';
		dataDtIdx++;

		if ((parseInt(currentPage) + 1) < Math.ceil(totalRecord / parseInt(perPage)) + 1) {
			paginationHtml += '<a class="paginate_button" aria-controls="logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) + 1) + '">' + (parseInt(currentPage) + 1) + '</a>';
			dataDtIdx++;
		}

		if (parseInt(currentPage) < Math.ceil(totalRecord / parseInt(perPage)) - 1) {
			if (((parseInt(currentPage) + 3) < Math.ceil(totalRecord / parseInt(perPage)) + 1)) {
				paginationHtml += '<span class="ellipsis">...</span>';
			}
			paginationHtml += '<a class="paginate_button" aria-controls="logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">' + Math.ceil(totalRecord / parseInt(perPage)) + '</a>';
			dataDtIdx++;
		}

		paginationHtml += '</span>';
		paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="logs-data-table_next_1" data-pageno="' + (parseInt(currentPage) + 1) + '">Next</a>';
		dataDtIdx++;
		paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="logs-data-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">Last</a>';
	}

	$('body').find('#logs-data-table_paginate').html(paginationHtml);
}

async function viewLogsPaginaiton(perPage, currentPage, totalRecord) {
	$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
	let startEntry = (parseInt(currentPage) == 1) ? 1 : ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1);
	let endEntry = (parseInt(currentPage) == 1) ? parseInt(perPage) : (parseInt(perPage) * parseInt(currentPage));
	endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

	if (totalRecord == 0) {
		startEntry = 0;
	}

	const showpage = `Showing ${startEntry} to ${endEntry} of ${totalRecord} entries`;
	$('body').find('#view-logs-data-table_info').html(showpage);

	let dataDtIdx = 0;
	let paginationHtml = '';
	let firstDisable = (parseInt(currentPage) == 1) ? 'disabled' : '';
	let lastDisable = (parseInt(currentPage) == Math.ceil(totalRecord / parseInt(perPage))) ? 'disabled' : '';

	if (Math.ceil(totalRecord / parseInt(perPage)) > 0) {
		paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="view-logs-data-table_first_1" data-pageno="1">First</a>';
		dataDtIdx++;
		paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="view-logs-data-table_previous_1" data-pageno="' + (parseInt(currentPage) - 1) + '">Previous</a>';
		paginationHtml += '<span>';
		dataDtIdx++;

		if (parseInt(currentPage) > 2) {
			paginationHtml += '<a class="paginate_button" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
			if (parseInt(currentPage) > 3) {
				paginationHtml += '<span class="ellipsis">...</span>';
			}
			dataDtIdx++;
		}

		if ((parseInt(currentPage) - 1) > 0) {
			paginationHtml += '<a class="paginate_button" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) - 1) + '">' + (parseInt(currentPage) - 1) + '</a>';
			dataDtIdx++;
		}

		paginationHtml += '<a class="paginate_button current" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(currentPage) + '">' + parseInt(currentPage) + '</a>';
		dataDtIdx++;

		if ((parseInt(currentPage) + 1) < Math.ceil(totalRecord / parseInt(perPage)) + 1) {
			paginationHtml += '<a class="paginate_button" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) + 1) + '">' + (parseInt(currentPage) + 1) + '</a>';
			dataDtIdx++;
		}

		if (parseInt(currentPage) < Math.ceil(totalRecord / parseInt(perPage)) - 1) {
			if (((parseInt(currentPage) + 3) < Math.ceil(totalRecord / parseInt(perPage)) + 1)) {
				paginationHtml += '<span class="ellipsis">...</span>';
			}
			paginationHtml += '<a class="paginate_button" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">' + Math.ceil(totalRecord / parseInt(perPage)) + '</a>';
			dataDtIdx++;
		}

		paginationHtml += '</span>';
		paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="view-logs-data-table_next_1" data-pageno="' + (parseInt(currentPage) + 1) + '">Next</a>';
		dataDtIdx++;
		paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="view-logs-data-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">Last</a>';
	}

	$('body').find('#view-logs-data-table_paginate').html(paginationHtml);
}

if ($('#form-log-description-create').length && itemLogPage) {
	formValidator = $('#form-log-description-create').validate({
		rules: {

		},
		messages: {

		},
		submitHandler: function (form) {
			handleFormSubmit();
		},
		errorPlacement: function (error, element) {
			clearErrorForElement(element);
			showError(element, error.text());
		}
	});

	function showError($input, message) {
		const errorElement = $('<div class="help-block animation-slideDown error"></div>');
		errorElement.text(message);
		$input.addClass('error');
		$input.closest('.form-group').append(errorElement);
	}

	function clearErrorForElement(element) {
		const $input = $(element);
		$input.closest('.form-group').find('.help-block').remove();
		$input.removeClass('error');
	}

	function handleFormSubmit() {
		$('#form-log-description-create').find('button[type="submit"]').prop('disabled', true);
		$('.overlay, body').removeClass('loaded');
		$('.overlay').css({ 'display': 'block' });

		const data = {
			log_description: $('#log-description-value').val(),
			uniqueId: $('#log-unique-id').val()
		};

		$.ajax({
			url: '/logs/update-log-description',
			method: 'POST',
			data: data,
			success: function (response) {
				if (response.status === 1) {
					getLogsData(logsPerPage, logsCurrentPage, logsItemId, itemLogFromDate, itemLogToDate)
					$('#log-description-modal-slide-in').modal('hide');
				} else {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });
					Swal.fire({
						title: 'Error!',
						text: response.message,
						icon: 'error',
						customClass: {
							confirmButton: 'btn btn-primary'
						},
						buttonsStyling: false,
						timer: 1200
					});
				}
			},
			error: function (err) {
				console.error("Error saving:", err);
			},
			complete: function () {
				$('#form-log-description-create').find('button[type="submit"]').prop('disabled', false);
				$('.overlay').hide();
			}
		});

	}

	$('#update-log-description').on('click', function (e) {
		e.preventDefault();
		const isValid = $('#form-log-description-create').valid();
		if (isValid) {
			handleFormSubmit(); // validator already approved
		}
	});
}


if ($('#logs-data-table').length && itemLogPage) {
	if (!logsTable) {
		logsTable = $('#logs-data-table').DataTable({
			order: [[8, 'desc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: logsPerPage,
			pagingType: 'full_numbers',
			aoColumns: [
				null,
				null,
				null,
				null,
				null,
				{ width: "200px" },
				null,
				null,
				null,
				null,
				null,
				null
			]
		});
	}

	function getCookieJSON(name) {
		const value = `; ${document.cookie}`;
		const parts = value.split(`; ${name}=`);
		if (parts.length === 2) {
			try {
				const decoded = decodeURIComponent(parts.pop().split(';').shift());
				return JSON.parse(decoded);
			} catch (e) {
				console.error('Invalid logsCondition cookie:', e);
			}
		}
		return null;
	}

	$('body').on('click', 'button.item-logs-modal', function () {
		itemLogPage = true;
		logsItemId = $(this).attr('data-id');

		const query = getCookieJSON('logsCondition');
		let itemLogFromDate, itemLogToDate, matchedLabel = null;

		if (query?.time === "Custom Range" && query.viewFromDate && query.viewToDate) {
			itemLogFromDate = query.viewFromDate;
			itemLogToDate = query.viewToDate;
			matchedLabel = "Custom Range";
		} else if (query?.time && timeOptions[query.time]) {
			const now = new Date();
			matchedLabel = query.time;
			itemLogFromDate = new Date(now.getTime() - timeOptions[matchedLabel] * 60000).toISOString();
			itemLogToDate = now.toISOString();
		} else if (query?.viewFromDate && query?.viewToDate) {
			itemLogFromDate = query.viewFromDate;
			itemLogToDate = query.viewToDate;
			matchedLabel = "Custom Range";
		} else {
			const now = new Date();
			itemLogToDate = now.toISOString();
			itemLogFromDate = new Date(now.getTime() - 30 * 60000).toISOString();
		}

		const startMoment = moment(itemLogFromDate);
		const endMoment = moment(itemLogToDate);

		// Initialize ranges
		const ranges = {};
		Object.entries(timeOptions).forEach(([label, minutes]) => {
			ranges[label] = [moment().subtract(minutes, 'minutes'), moment()];
		});

		// Setup date range picker
		$('#itemLogRange').daterangepicker({
			ranges,
			timePicker: true,
			timePicker24Hour: true,
			timePickerSeconds: true,
			locale: { format: 'MMMM D, YYYY HH:mm:ss' },
			startDate: startMoment,
			endDate: endMoment
		}, (start, end) => {
			itemLogFromDate = start.toISOString();
			itemLogToDate = end.toISOString();

			// Find matching label or use Custom Range
			let newMatchedLabel = matchedLabel;
			for (const [label, range] of Object.entries(ranges)) {
				if (start.isSame(moment(range[0]), 'minute') && end.isSame(moment(range[1]), 'minute')) {
					newMatchedLabel = label;
					break;
				}
			}

			// Update display
			const $rangeSpan = $('#itemLogRange span');
			const $sinceTime = $('.since-time-item');
			const $rangesLi = $('.ranges li');
			$rangesLi.removeClass('active');

			if (newMatchedLabel && ranges[newMatchedLabel]) {
				$rangeSpan.html(newMatchedLabel);
				$sinceTime.text(newMatchedLabel);
				$rangesLi.filter(li => $(li).text().trim() === newMatchedLabel).addClass('active');
			} else {
				const formattedRange = `${start.format('MMMM D, YYYY HH:mm:ss')} - ${end.format('MMMM D, YYYY HH:mm:ss')}`;
				$rangeSpan.html(formattedRange);
				$sinceTime.text(formattedRange);
				$rangesLi.filter(li => $(li).text().trim() === "Custom Range").addClass('active');
			}

			// Update viewFromDate and viewToDate
			const viewFromDate = start.toISOString();
			const viewToDate = end.toISOString();

			// Use newMatchedLabel or Custom Range as time, avoid duplication
			const timeLabel = newMatchedLabel || 'Custom Range';
			const existingQuery = getCookieJSON('logsCondition') || {};
			const queryObj = { ...existingQuery, time: timeLabel, viewFromDate, viewToDate };

			setCookie('logsCondition', JSON.stringify(queryObj));

			getLogsData(logsPerPage, logsCurrentPage, logsItemId, itemLogFromDate, itemLogToDate);
		});

		const drp = $('#itemLogRange').data('daterangepicker');
		if (!drp) {
			console.error("Date range picker not initialized!");
			return;
		}

		drp.setStartDate(startMoment);
		drp.setEndDate(endMoment);

		// Find matching label if not already set
		if (!matchedLabel) {
			for (const [label, range] of Object.entries(drp.ranges)) {
				if (startMoment.isSame(moment(range[0]), 'minute') && endMoment.isSame(moment(range[1]), 'minute')) {
					matchedLabel = label;
					break;
				}
			}
			matchedLabel = matchedLabel || "Custom Range";
		}

		// Set initial display
		const $rangeSpan = $('#itemLogRange span');
		const $sinceTime = $('.since-time-item');
		const $rangesLi = $('.ranges li');
		$rangesLi.removeClass('active');

		if (matchedLabel && drp.ranges[matchedLabel]) {
			$rangeSpan.html(matchedLabel);
			$sinceTime.text(matchedLabel);
			$rangesLi.filter(li => $(li).text().trim() === matchedLabel).addClass('active');
		} else {
			const formattedRange = `${startMoment.format('MMMM D, YYYY HH:mm:ss')} - ${endMoment.format('MMMM D, YYYY HH:mm:ss')}`;
			$rangeSpan.html(formattedRange);
			$sinceTime.text(formattedRange);
			$rangesLi.filter(li => $(li).text().trim() === "Custom Range").addClass('active');
		}

		// Initialize or reload DataTable
		if (logsItemId) {
			logsPerPage = 50;
			logsCurrentPage = 1;

			if ($.fn.DataTable.isDataTable('#logs-data-table')) {
				logsTable.clear().destroy();
			}

			logsTable = $('#logs-data-table').DataTable({
				order: [[8, 'desc']],
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: logsPerPage,
				pagingType: 'full_numbers',
				aoColumns: [
					null, null, null, null, null,
					{ width: "200px" }, null, null, null, null, null, null
				]
			});

			getLogsData(logsPerPage, logsCurrentPage, logsItemId, itemLogFromDate, itemLogToDate);
		}
	});

	$('body').on('click', '#logs-data-table_paginate .paginate_button', function () {
		logsCurrentPage = $(this).attr('data-pageno');
		logsTable.clear();
		logsTable.destroy();
		logsTable = $('#logs-data-table').DataTable({
			order: [[8, 'desc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: logsPerPage,
			pagingType: 'full_numbers',
			aoColumns: [
				null,
				null,
				null,
				null,
				null,
				{ width: "200px" },
				null,
				null,
				null,
				null,
				null,
				null
			]
		});

		getLogsData(parseInt(logsPerPage), parseInt(logsCurrentPage), logsItemId, itemLogFromDate, itemLogToDate);
	});

	logsTable.on('draw', function () {
		const perPage = logsTable.page.info().length;
		logsPagination(perPage, logsCurrentPage, resLogTotalRecords);
	});

	$('body').on('change', '#logs-data-table_length select', function () {
		logsPerPage = $('#logs-data-table_length select').val();
		logsCurrentPage = 1;
		logsTable.clear();
		logsTable.destroy();
		logsTable = $('#logs-data-table').DataTable({
			order: [[8, 'desc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: logsPerPage,
			pagingType: 'full_numbers',
			aoColumns: [
				null,
				null,
				null,
				null,
				null,
				{ width: "200px" },
				null,
				null,
				null,
				null,
				null,
				null
			]
		});

		getLogsData(parseInt(logsPerPage), parseInt(logsCurrentPage), logsItemId, itemLogFromDate, itemLogToDate);
	});

	viewLogsTable = $('#view-logs-data-table').DataTable({
		order: [[5, 'asc']],
		aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
		iDisplayLength: viewLogsPerPage,
		pagingType: 'full_numbers',
		aoColumns: [
			null,
			null,
			null,
			null,
			null,
			null,
			null
		]
	});

	viewNewLogsTable = $('#view-new-logs-data-table').DataTable({
		ordering: false,
		paging: false,
		searching: false,
		info: false,
		lengthChange: false,
	});

	$('body').on('click', 'button.view-item-logs-modal', function () {
		viewLogsItemId = $(this).attr('data-id');
		viewLogsType = $(this).attr('data-type');
		viewLogsCurrentPage = 1;
		viewNewLogsTable.clear();
		viewNewLogsTable.destroy();
		viewNewLogsTable = $('#view-new-logs-data-table').DataTable({
			ordering: false,
			paging: false,
			searching: false,
			info: false,
			lengthChange: false,
		});

		getViewLogsData(viewLogsPerPage, viewLogsCurrentPage, viewLogsItemId, viewLogsType);
	});

	viewLogsTable.on('draw', function () {
		const perPage = viewLogsTable.page.info().length;
		viewLogsPaginaiton(perPage, viewLogsCurrentPage, resViewlogTotalRecords);
	});

	$('body').on('click', '#view-logs-data-table_paginate .paginate_button', function () {
		viewLogsCurrentPage = $(this).attr('data-pageno');
		viewLogsTable.clear();
		viewLogsTable.destroy();
		viewLogsTable = $('#view-logs-data-table').DataTable({
			order: [[5, 'asc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: viewLogsPerPage,
			pagingType: 'full_numbers',
			aoColumns: [
				null,
				null,
				null,
				null,
				null,
				null,
				null
			]
		});

		oldViewLogDataItem(parseInt(viewLogsPerPage), parseInt(viewLogsCurrentPage), viewLogsItemId);
	});

	$('body').on('change', '#view-logs-data-table_length select', function () {
		viewLogsPerPage = $('#view-logs-data-table_length select').val();
		viewLogsCurrentPage = 1;
		viewLogsTable.clear();
		viewLogsTable.destroy();
		viewLogsTable = $('#view-logs-data-table').DataTable({
			order: [[5, 'asc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: viewLogsPerPage,
			pagingType: 'full_numbers',
			aoColumns: [
				null,
				null,
				null,
				null,
				null,
				null,
				null
			]
		});

		oldViewLogDataItem(parseInt(viewLogsPerPage), parseInt(viewLogsCurrentPage), viewLogsItemId);
	});

	$('#log-details-page').on('click', function () {
		let uniqueId = $(this).attr('data-uniqueid-log');
		resetLogViews();
		oldViewLogDataItem(viewLogsPerPage, viewLogsCurrentPage, uniqueId)
	});


	function resetLogViews() {
		$('#view-new-item-logs-modal-slide-in').modal('show');
		$('.overlay, body').removeClass('loaded');
		$('.overlay').css({ 'display': 'block' });
		if (viewLogsTable) {
			viewLogsTable.clear().draw();
		}
		if (emailLogsTable) {
			$("#table-content").empty();
			emailLogsTable.clear().draw();
		}
		viewLogsItemId = null;
		viewLogsType = null;
	}

	$('#log-curl-request').on('click', function () {
		let curlRequest = $(this).attr('data-uniqueid-curl-request');
		$('#details-curl-base').text(curlRequest);
		$('#view-curl-bash-slide-in').modal('show');
	});

	$('#copy-content-btn').on('click', function () {
		let curlRequest = $('#log-req-res-request').attr('data-uniqueid-curl-request');
		navigator.clipboard.writeText(curlRequest)
			.then(() => {
				Swal.fire({
					title: 'Success!',
					text: "Request copied to clipboard",
					icon: 'success',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			})
			.catch(err => {
				Swal.fire({
					title: 'Error!',
					text: err.message,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			});
	});

	$('#copy-curl-btn').on('click', function () {
		let curlRequest = $('#log-curl-request').attr('data-uniqueid-curl-request');
		navigator.clipboard.writeText(curlRequest)
			.then(() => {
				Swal.fire({
					title: 'Success!',
					text: "Request copied to clipboard",
					icon: 'success',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			})
			.catch(err => {
				Swal.fire({
					title: 'Error!',
					text: err.message,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			});
	});

	$('#log-curl-request-copy').on('click', function () {
		let curlRequest = $('#log-curl-request').attr('data-uniqueid-curl-request');
		navigator.clipboard.writeText(curlRequest)
			.then(() => {
				Swal.fire({
					title: 'Success!',
					text: "Request copied to clipboard",
					icon: 'success',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			})
			.catch(err => {
				Swal.fire({
					title: 'Error!',
					text: err.message,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			});
	});

	async function getViewLogsData(perPage, currentPage, uniqueId, logType) {
		$('.inbound-entrypoint-value').text('');
		if (logType === "FTP" || logType === "SFTP") {
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({ 'display': 'block' });
			$('#view-logs-data-table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty"><div class="tableloader"></div></td></tr>');
			$('.hiddle_feilds').hide();
			await viewLogsforFtpView(perPage, currentPage, uniqueId, logType);
		} else {
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({ 'display': 'block' });
			$('#view-new-logs-data-table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty"><div class="tableloader"></div></td></tr>');
			$('.hiddle_feilds').show();
			await $.ajax({
				url: '/logs/logNewViewFullList',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ type: 'log', uniqueId }),
				success: function (response) {
					responseData = response.data;
					resViewlogTotalRecords = parseInt(response.total);
					let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
					let totalRecord = parseInt(response.total);

					if (response.data.length <= 0) {
						$('#view-new-logs-data-table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty">No data available in table</td></tr>');
					}

					if (response.partitionedData.length > 0) {
						let findurlEntryPoint = response.partitionedData[0].find((x) => x.action === "Inbound Get");
						if (findurlEntryPoint) {
							$('.inbound-entrypoint-value').text(findurlEntryPoint.datas);
						}
					}

					$('#log-details-page').attr('data-uniqueid-log', uniqueId);
					$('#log-curl-request, #log-curl-request-copy').prop('disabled', false);

					if (response.partitionedData.length > 0) {
						let curlrecord = response.partitionedData[0].find((x) => x.action === "Inbound Entrypoint");
						if (curlrecord && curlrecord.datas) {
							$('#log-curl-request').attr('data-uniqueid-curl-request', curlrecord.datas);
						} else {
							$('#log-curl-request, #log-curl-request-copy').prop('disabled', true);
						}
					}

					$.each(response.finalResponse, function (index, data) {
						let outbound_endpoint = "";
						let time_consumed_ms = "";
						let status = "";
						let status_code = "";
						let request = "";
						let inboundMail = "";
						let transformed_request = "";
						let request_filter = "";
						let validation = "";
						let trigger_rule = "";
						let request_return_url = "";
						let response = "";
						let outboundMail = "";
						let transformed_response = "";
						let response_filter = "";
						let response_validation = "";
						let response_return_url = "";
						let response_failure_url = "";
						let outbound_entrypoint = "";

						// Safely assign values if exist
						if (data.outbound_endpoint) { outbound_endpoint = data.outbound_endpoint; }
						if (data.time_consumed_ms) { time_consumed_ms = data.time_consumed_ms; }
						if (data.status) { status = data.status; }
						if (data.status_code) { status_code = data.status_code; }
						if (data.request) { request = data.request; }
						if (data.transformed_request) { transformed_request = data.transformed_request; }
						if (data.request_filter) { request_filter = data.request_filter; }
						if (data.validation) { validation = data.validation; }
						if (data.trigger_rule) { trigger_rule = data.trigger_rule; }
						if (data.request_return_url) { request_return_url = data.request_return_url; }
						if (data.response) { response = data.response; }
						if (data.transformed_response) { transformed_response = data.transformed_response; }
						if (data.response_filter) { response_filter = data.response_filter; }
						if (data.response_validation) { response_validation = data.response_validation; }
						if (data.response_return_url) { response_return_url = data.response_return_url; }
						if (data.inboundMail && data.inboundMail.length > 0) { inboundMail = data.inboundMail }
						if (data.outboundMail && data.outboundMail.length > 0) { outboundMail = data.outboundMail }
						if (data.outbound_entrypoint) { outbound_entrypoint = data.outbound_entrypoint }
						if (data.response_failure_url) { response_failure_url = data.response_failure_url }

						let $button_group_request = '<div class="btn-group-vertical text-center" role="group">';
						if (request?.datas) {
							$button_group_request += createViewButtonForItem(request.datas);
						}
						if (inboundMail?.length) {
							$button_group_request += createEmailButtonForItem(inboundMail);
						}
						$button_group_request += '</div>';

						let $button_group_transformed_request = '';
						$button_group_transformed_request = '<div class="btn-group-vertical text-center" role="group">';
						if (transformed_request && transformed_request.datas) {
							$button_group_transformed_request += createViewButtonForItem(transformed_request.datas);
						}
						if (transformed_request && transformed_request.message) {
							$button_group_transformed_request += `<span class="text-center mt-1 w-100">${transformed_request.message}</span>`;
						}
						$button_group_transformed_request += '</div>';

						let $button_group_request_filter = '<div class="btn-group-vertical text-center" role="group">';
						if (request_filter?.datas) {
							$button_group_request_filter += createViewButtonForItem(request_filter.datas);
						}
						if (request_filter?.message) {
							$button_group_request_filter += `<span class="text-center mt-1 w-100">${request_filter.message}</span>`;
						}
						$button_group_request_filter += '</div>';

						let $button_group_validation = '<div class="btn-group-vertical text-center" role="group">';
						if (validation?.datas) {
							$button_group_validation += createViewButtonForItem(validation.datas);
						}
						if (validation?.message) {
							$button_group_validation += `<span class="text-center mt-1 w-100">${validation.message}</span>`;
						}
						$button_group_validation += '</div>';

						// Trigger Rule
						let $button_group_trigger_rule = '<div class="btn-group-vertical text-center" role="group">';
						if (trigger_rule?.datas) {
							$button_group_trigger_rule += createViewButtonForItem(trigger_rule.datas);
						}
						if (trigger_rule?.message) {
							$button_group_trigger_rule += `<span class="text-center mt-1 w-100">${trigger_rule.message}</span>`;
						}
						$button_group_trigger_rule += '</div>';

						// Request Return URL
						let $button_group_request_return_url = '<div class="btn-group-vertical text-center" role="group">';
						if (request_return_url?.datas) {
							$button_group_request_return_url += createViewButtonForItem(request_return_url.datas);
						}
						if (request_return_url?.message) {
							$button_group_request_return_url += `<span class="text-center mt-1 w-100">${request_return_url.message}</span>`;
						}
						$button_group_request_return_url += '</div>';

						// Curl Base
						let $button_group_curl_base = '<div class="btn-group-vertical text-center" role="group">';
						if (outbound_entrypoint?.datas) {
							$button_group_curl_base += createViewButtonForItem(outbound_entrypoint.datas, "curl");
						}
						if (outbound_entrypoint?.message) {
							$button_group_curl_base += `<span class="text-center mt-1 w-100">${outbound_entrypoint.message}</span>`;
						}
						$button_group_curl_base += '</div>';


						// Response
						let $button_group_response = '<div class="btn-group-vertical text-center" role="group">';
						if (response?.datas) {
							$button_group_response += createViewButtonForItem(response.datas);
						}
						if (outboundMail?.length) {
							$button_group_response += createEmailButtonForItem(outboundMail);
						}
						if (response?.message) {
							$button_group_response += `<span class="text-center mt-1 w-100">${response.message}</span>`;
						}
						$button_group_response += '</div>';

						// Transformed Response
						let $button_group_transformed_response = '<div class="btn-group-vertical text-center" role="group">';
						if (transformed_response?.datas) {
							$button_group_transformed_response += createViewButtonForItem(transformed_response.datas);
						}
						if (transformed_response?.message) {
							$button_group_transformed_response += `<span class="text-center mt-1 w-100">${transformed_response.message}</span>`;
						}
						$button_group_transformed_response += '</div>';

						// Response Filter
						let $button_group_response_filter = '<div class="btn-group-vertical text-center" role="group">';
						if (response_filter?.datas) {
							$button_group_response_filter += createViewButtonForItem(response_filter.datas);
						}
						if (response_filter?.message) {
							$button_group_response_filter += `<span class="text-center mt-1 w-100">${response_filter.message}</span>`;
						}
						$button_group_response_filter += '</div>';

						// Response Validation
						let $button_group_response_validation = '<div class="btn-group-vertical text-center" role="group">';
						if (response_validation?.datas) {
							$button_group_response_validation += createViewButtonForItem(response_validation.datas);
						}
						if (response_validation?.message) {
							$button_group_response_validation += `<span class="text-center mt-1 w-100">${response_validation.message}</span>`;
						}
						$button_group_response_validation += '</div>';

						// Response Return URL
						let $button_group_response_return_url = '<div class="btn-group-vertical text-center" role="group">';
						if (response_return_url?.datas) {
							$button_group_response_return_url += createViewButtonForItem(response_return_url.datas);
						}
						if (response_return_url?.message) {
							$button_group_response_return_url += `<span class="text-center mt-1 w-100">${response_return_url.message}</span>`;
						}
						$button_group_response_return_url += '</div>';

						// Response Failure Return URL
						let $button_group_response_failure_return_url = '<div class="btn-group-vertical text-center" role="group">';
						if (response_failure_url?.datas) {
							$button_group_response_failure_return_url += createViewButtonForItem(response_failure_url.datas);
						}
						if (response_failure_url?.message) {
							$button_group_response_failure_return_url += `<span class="text-center mt-1 w-100">${response_failure_url.message}</span>`;
						}
						$button_group_response_failure_return_url += '</div>';

						// Add row to DataTable matching the 15 columns you provided
						viewNewLogsTable.row.add([
							counter++,             // No
							outbound_endpoint,     // Outbound Endpoint
							time_consumed_ms,      // TIME CONSUMED (MS)
							status,                // STATUS
							status_code,           // STATUS CODE
							$button_group_curl_base,
							$button_group_request,               // REQUEST
							$button_group_transformed_request,   // TRANSFORMED REQUEST
							$button_group_request_filter,        // REQUEST FILTER
							$button_group_validation,            // VALIDATION
							$button_group_trigger_rule,        	 // TRIGGER RULES
							$button_group_request_return_url,    // REQUEST RETURN URL
							$button_group_response,              // RESPONSE
							$button_group_transformed_response,  // TRANSFORMED RESPONSE
							$button_group_response_filter,       // RESPONSE FILTER
							$button_group_response_validation,   // RESPONSE VALIDATION
							$button_group_response_return_url,    // RESPONSE RETURN URL
							$button_group_response_failure_return_url
						]).draw(false);
					});
					viewLogsItemId = uniqueId;
					viewLogsType = logType;
					$('#view-new-item-logs-modal-slide-in').modal('show');
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });
				},
				error: function (xhr, status, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });

					Swal.fire({
						title: 'Error!',
						text: xhr?.responseJSON?.message,
						icon: 'error',
						customClass: {
							confirmButton: 'btn btn-primary'
						},
						buttonsStyling: false,
						timer: 1200
					});

					return false;
				}
			});
		}
	}

	async function viewLogsforFtpView(perPage, currentPage, uniqueId, logType) {
		await $.ajax({
			url: '/logs/logNewViewFullListForftp',
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ type: 'log', uniqueId }),
			success: function (response) {
				responseData = response.data;
				resViewlogTotalRecords = parseInt(response.total);
				let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
				let totalRecord = parseInt(response.total);

				if (response.data.length <= 0) {
					$('#view-new-logs-data-table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty">No data available in table</td></tr>');
				}

				if (response.partitionedData.length > 0) {
					let findurlEntryPoint = response.partitionedData[0].find((x) => x.action === "Entrypoint Get");
					if (findurlEntryPoint) {
						$('.inbound-entrypoint-value').text(findurlEntryPoint.description);
					}
				}

				$('#log-details-page').attr('data-uniqueid-log', uniqueId);

				$.each(response.finalResponse, function (index, data) {
					let outbound_endpoint = "";
					let time_consumed_ms = "";
					let status = "";
					let status_code = "";
					let request = "";
					let inboundMail = "";
					let transformed_request = "";
					let request_filter = "";
					let validation = "";
					let trigger_rule = "";
					let request_return_url = "";
					let response = "";
					let outboundMail = "";
					let transformed_response = "";
					let response_filter = "";
					let response_validation = "";
					let response_return_url = "";
					let outbound_entrypoint = "";

					// Safely assign values if exist
					if (data.outbound_endpoint) { outbound_endpoint = data.outbound_endpoint; }
					if (data.time_consumed_ms) { time_consumed_ms = data.time_consumed_ms; }
					if (data.status) { status = data.status; }
					if (data.status_code) { status_code = data.status_code; }
					if (data.request) { request = data.request; }
					if (data.transformed_request) { transformed_request = data.transformed_request; }
					if (data.request_filter) { request_filter = data.request_filter; }
					if (data.validation) { validation = data.validation; }
					if (data.trigger_rule) { trigger_rule = data.trigger_rule; }
					if (data.request_return_url) { request_return_url = data.request_return_url; }
					if (data.response) { response = data.response; }
					if (data.transformed_response) { transformed_response = data.transformed_response; }
					if (data.response_filter) { response_filter = data.response_filter; }
					if (data.response_validation) { response_validation = data.response_validation; }
					if (data.response_return_url) { response_return_url = data.response_return_url; }
					if (data.inboundMail && data.inboundMail.length > 0) { inboundMail = data.inboundMail }
					if (data.outboundMail && data.outboundMail.length > 0) { outboundMail = data.outboundMail }
					if (data.outbound_entrypoint) { outbound_entrypoint = data.outbound_entrypoint }

					let $button_group_request = '<div class="btn-group-vertical text-center" role="group">';
					if (request?.datas) {
						$button_group_request += createViewButtonForItem(request.datas);
					}
					if (inboundMail?.length) {
						$button_group_request += createEmailButtonForItem(inboundMail);
					}
					$button_group_request += '</div>';

					let $button_group_transformed_request = '';
					$button_group_transformed_request = '<div class="btn-group-vertical text-center" role="group">';
					if (transformed_request && transformed_request.datas) {
						$button_group_transformed_request += createViewButtonForItem(transformed_request.datas);
					}
					if (transformed_request && transformed_request.message) {
						$button_group_transformed_request += `<span class="text-center mt-1 w-100">${transformed_request.message}</span>`;
					}
					$button_group_transformed_request += '</div>';

					let $button_group_request_filter = '<div class="btn-group-vertical text-center" role="group">';
					if (request_filter?.datas) {
						$button_group_request_filter += createViewButtonForItem(request_filter.datas);
					}
					if (request_filter?.message) {
						$button_group_request_filter += `<span class="text-center mt-1 w-100">${request_filter.message}</span>`;
					}
					$button_group_request_filter += '</div>';

					let $button_group_validation = '<div class="btn-group-vertical text-center" role="group">';
					if (validation?.datas) {
						$button_group_validation += createViewButtonForItem(validation.datas);
					}
					if (validation?.message) {
						$button_group_validation += `<span class="text-center mt-1 w-100">${validation.message}</span>`;
					}
					$button_group_validation += '</div>';

					// Trigger Rule
					let $button_group_trigger_rule = '<div class="btn-group-vertical text-center" role="group">';
					if (trigger_rule?.datas) {
						$button_group_trigger_rule += createViewButtonForItem(trigger_rule.datas);
					}
					if (trigger_rule?.message) {
						$button_group_trigger_rule += `<span class="text-center mt-1 w-100">${trigger_rule.message}</span>`;
					}
					$button_group_trigger_rule += '</div>';

					// Request Return URL
					let $button_group_request_return_url = '<div class="btn-group-vertical text-center" role="group">';
					if (request_return_url?.datas) {
						$button_group_request_return_url += createViewButtonForItem(request_return_url.datas);
					}
					if (request_return_url?.message) {
						$button_group_request_return_url += `<span class="text-center mt-1 w-100">${request_return_url.message}</span>`;
					}
					$button_group_request_return_url += '</div>';

					// Curl Base
					let $button_group_curl_base = '<div class="btn-group-vertical text-center" role="group">';
					if (outbound_entrypoint?.datas) {
						$button_group_curl_base += createViewButtonForItem(outbound_entrypoint.datas, "curl");
					}
					if (outbound_entrypoint?.message) {
						$button_group_curl_base += `<span class="text-center mt-1 w-100">${outbound_entrypoint.message}</span>`;
					}
					$button_group_curl_base += '</div>';


					// Response
					let $button_group_response = '<div class="btn-group-vertical text-center" role="group">';
					if (response?.datas) {
						$button_group_response += createViewButtonForItem(response.datas);
						$button_group_response += createEmailButtonForItem(outboundMail);
					}
					if (response?.message) {
						$button_group_response += `<span class="text-center mt-1 w-100">${response.message}</span>`;
					}
					$button_group_response += '</div>';

					// Transformed Response
					let $button_group_transformed_response = '<div class="btn-group-vertical text-center" role="group">';
					if (transformed_response?.datas) {
						$button_group_transformed_response += createViewButtonForItem(transformed_response.datas);
					}
					if (transformed_response?.message) {
						$button_group_transformed_response += `<span class="text-center mt-1 w-100">${transformed_response.message}</span>`;
					}
					$button_group_transformed_response += '</div>';

					// Response Filter
					let $button_group_response_filter = '<div class="btn-group-vertical text-center" role="group">';
					if (response_filter?.datas) {
						$button_group_response_filter += createViewButtonForItem(response_filter.datas);
					}
					if (response_filter?.message) {
						$button_group_response_filter += `<span class="text-center mt-1 w-100">${response_filter.message}</span>`;
					}
					$button_group_response_filter += '</div>';

					// Response Validation
					let $button_group_response_validation = '<div class="btn-group-vertical text-center" role="group">';
					if (response_validation?.datas) {
						$button_group_response_validation += createViewButtonForItem(response_validation.datas);
					}
					if (response_validation?.message) {
						$button_group_response_validation += `<span class="text-center mt-1 w-100">${response_validation.message}</span>`;
					}
					$button_group_response_validation += '</div>';

					// Response Return URL
					let $button_group_response_return_url = '<div class="btn-group-vertical text-center" role="group">';
					if (response_return_url?.datas) {
						$button_group_response_return_url += createViewButtonForItem(response_return_url.datas);
					}
					if (response_return_url?.message) {
						$button_group_response_return_url += `<span class="text-center mt-1 w-100">${response_return_url.message}</span>`;
					}
					$button_group_response_return_url += '</div>';


					// Add row to DataTable matching the 15 columns you provided
					viewNewLogsTable.row.add([
						counter++,             // No
						outbound_endpoint,     // Outbound Endpoint
						time_consumed_ms,      // TIME CONSUMED (MS)
						status,                // STATUS
						status_code,           // STATUS CODE
						$button_group_curl_base,
						$button_group_request,               // REQUEST
						$button_group_transformed_request,   // TRANSFORMED REQUEST
						$button_group_request_filter,        // REQUEST FILTER
						$button_group_validation,            // VALIDATION
						$button_group_trigger_rule,        	 // TRIGGER RULES
						$button_group_request_return_url,    // REQUEST RETURN URL
						$button_group_response,              // RESPONSE
						$button_group_transformed_response,  // TRANSFORMED RESPONSE
						$button_group_response_filter,       // RESPONSE FILTER
						$button_group_response_validation,   // RESPONSE VALIDATION
						$button_group_response_return_url    // RESPONSE RETURN URL
					]).draw(false);
				});
				viewLogsItemId = uniqueId;
				viewLogsType = logType;
				$('#view-new-item-logs-modal-slide-in').modal('show');
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });
			},
			error: function (xhr, status, error) {
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });

				Swal.fire({
					title: 'Error!',
					text: xhr?.responseJSON?.message,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});

				return false;
			}
		});
	}

	async function oldViewLogDataItem(perPage, currentPage, uniqueId) {
		await $.ajax({
			url: '/logs/logViewFullList',
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ page: parseInt(currentPage), limit: parseInt(perPage), type: 'log', uniqueId }),
			success: function (response) {
				responseData = response.data;
				resViewlogTotalRecords = parseInt(response.total);
				let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
				let totalRecord = parseInt(response.total);

				if (response.data.length <= 0) {
					$('#view-logs-data-table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty">No data available in table</td></tr>');
				}

				$.each(response.data, function (index, data) {
					const startDate = new Date(data.createdAt);
					const startYear = startDate.getFullYear();
					const startMonth = startDate.getMonth() + 1;
					const startDay = startDate.getDate();
					const startHours = (startDate.getHours() < 10 ? '0' : '') + startDate.getHours();
					const startMinutes = (startDate.getMinutes() < 10 ? '0' : '') + startDate.getMinutes();
					const startSeconds = (startDate.getSeconds() < 10 ? '0' : '') + startDate.getSeconds();
					const startMilliseconds = startDate.getMilliseconds();
					const startTime = startYear + '-' + (startMonth < 10 ? '0' : '') + startMonth + '-' + (startDay < 10 ? '0' : '') + startDay + ' ' + startHours + ':' + startMinutes + ':' + startSeconds;

					let $button_group = '<div class="btn-group" role="group" aria-label="Action Buttons">';
					if (data.datas && data.datas !== "") {
						$button_group += '<button type="button" class="btn btn-outline-secondary" data-toggle="tooltip" title="View" data-uniqueId="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>';
					}
					$button_group += '</div>';

					viewLogsTable.row.add([
						counter++,
						data.action,
						data.description,
						data.type,
						data.httpStatus || '',
						startTime,
						$button_group
					]).draw(false);
				});
				viewLogsPaginaiton(perPage, currentPage, totalRecord)
				viewLogsItemId = uniqueId;
				$('#view-item-logs-modal-slide-in').modal('show');
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });
			},
			error: function (xhr, status, error) {
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });

				Swal.fire({
					title: 'Error!',
					text: xhr?.responseJSON?.message,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});

				return false;
			}
		});
	}

	$('body').on('click', 'button[data-uniqueId]', function (event) {
		event.preventDefault();
		const uniqueId = $(this).attr('data-uniqueId');
		const dataObject = responseData.find(item => item._id === uniqueId);
		let datas;
		try {
			datas = JSON.parse(dataObject.datas);
		} catch (e) {
			datas = dataObject.datas;
		}
		const formattedData = typeof datas === 'object' ? JSON.stringify(datas, null, 4) : datas;
		$('#details-modal-body').text(formattedData);
		$('#log-req-res-request').attr('data-uniqueid-curl-request', formattedData);
		$('#details-modal-body').show();
		$('#table-content').hide();
		if (dataObject?.description == "User Posting Data" || dataObject?.description == "Mapped Data" || dataObject?.description == "Response Data" || dataObject.description == "CURL Bash") {
			$('#copy-content-btn').show();
		} else {
			$('#copy-content-btn').hide();
		}
		$('#view-item-logs-details-modal-slide-in').modal('show');
	});

	function createViewButtonForItem(datas, request) {
		if (!datas) return '';

		let parsedDatas;
		try {
			parsedDatas = typeof datas === 'string' ? JSON.parse(datas) : datas;
		} catch (e) {
			parsedDatas = datas;
		}

		// Safely stringify and escape quotes for HTML attribute
		const requestJson = JSON.stringify(parsedDatas).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

		return `<button type="button" class="btn btn-outline-secondary" data-toggle="tooltip" title="View" data-request='${requestJson}' data-curl='${request}' onclick="viewItemLogDetailsModelItem(this.getAttribute('data-request'), this.getAttribute('data-curl'))">
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>`;
	}

	function createEmailButtonForItem(datas) {
		if (!datas) return '';
		return `<button type="button" class="btn btn-outline-secondary mt-1" data-toggle="tooltip" title="View" data-request='${JSON.stringify(datas)}' onclick="viewEmailLogDetailsItems(this.getAttribute('data-request'))">
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" 
				viewBox="0 0 24 24" fill="none" stroke="currentColor" 
				stroke-width="2" stroke-linecap="round" stroke-linejoin="round" 
				class="feather feather-mail">
				<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4
				c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
				<polyline points="22,6 12,13 2,6"></polyline>
			</svg></button>`;
	}

	function partitionByInboundUserPosting(data) {
		const result = [];
		let currentPartition = [];

		for (const item of data) {
			if (item.action === "Inbound User Posting") {
				if (currentPartition.length > 0) {
					result.push(currentPartition);
					currentPartition = [];
				}
			}
			currentPartition.push(item);
		}

		if (currentPartition.length > 0) {
			result.push(currentPartition);
		}

		return result;
	}

	function viewItemLogDetailsModelItem(datasString, curl) {
		$('#copy-content-btn').show();
		if (curl !== "undefined") {
			let datas;
			try {
				datas = JSON.parse(datasString);
			} catch (e) {
				datas = datasString;
			}
			const formattedData = typeof datas === 'object' ? JSON.stringify(datas, null, 4) : datas;
			$('#details-curl-base').text(formattedData);
			$('#log-curl-request').attr('data-uniqueid-curl-request', formattedData);
			$('#view-curl-bash-slide-in').modal('show');
		} else {
			let datas;
			try {
				datas = JSON.parse(datasString);
			} catch (e) {
				datas = datasString;
			}
			const formattedData = typeof datas === 'object' ? JSON.stringify(datas, null, 4) : datas;

			$('#details-modal-body').show();
			$('#table-content').hide();
			$('#details-modal-body').text(formattedData);
			$('#log-req-res-request').attr('data-uniqueid-curl-request', formattedData);
			$('#view-item-logs-details-modal-slide-in').modal('show');
		}
	}

	function viewEmailLogDetailsItems(emailLogs) {
		let emailLog;
		try {
			emailLog = JSON.parse(emailLogs);
		} catch (e) {
			console.error("Invalid JSON:", e);
			return;
		}

		$('#details-modal-body').hide();
		$('#table-content').show();

		// Inject table into modal body
		$('#table-content').html(`
			<table class="datatables-basic table" id="email-logs-table">
				<thead>
					<tr>
						<th>No</th>
						<th>Action</th>
						<th>Description</th>
						<th>Type</th>
						<th>Http Status</th>
						<th>Time</th>
						<th>Details</th>
					</tr>
				</thead>
				<tbody></tbody>
			</table>
		`);

		// Destroy previous instance if exists
		if ($.fn.DataTable.isDataTable('#email-logs-table')) {
			$('#email-logs-table').DataTable().destroy();
		}

		// Bind to DataTable
		emailLogsTable = $('#email-logs-table').DataTable({
			columns: [
				{ title: "No" },
				{ title: "Action" },
				{ title: "Description" },
				{ title: "Type" },
				{ title: "Http Status" },
				{ title: "Time" },
				{ title: "Details" }
			],
			ordering: false,
			paging: false,
			searching: false,
			info: false,
			lengthChange: false
		});

		$.each(emailLog, function (index, data) {
			const startDate = new Date(data.createdAt);
			const startYear = startDate.getFullYear();
			const startMonth = startDate.getMonth() + 1;
			const startDay = startDate.getDate();
			const startHours = (startDate.getHours() < 10 ? '0' : '') + startDate.getHours();
			const startMinutes = (startDate.getMinutes() < 10 ? '0' : '') + startDate.getMinutes();
			const startSeconds = (startDate.getSeconds() < 10 ? '0' : '') + startDate.getSeconds();
			const startMilliseconds = startDate.getMilliseconds();
			const startTime = startYear + '-' + (startMonth < 10 ? '0' : '') + startMonth + '-' + (startDay < 10 ? '0' : '') + startDay + ' ' + startHours + ':' + startMinutes + ':' + startSeconds;

			let $button_group = '<div class="btn-group" role="group" aria-label="Action Buttons">';
			if (data.datas && data.datas !== "") {
				$button_group += '<button type="button" class="btn btn-outline-secondary" data-toggle="tooltip" title="View" data-uniqueId="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>';
			}
			$button_group += '</div>';

			emailLogsTable.row.add([
				index + 1,
				data.action,
				data.description,
				data.type,
				data.httpStatus || '',
				startTime,
				$button_group
			]).draw(false);
		});

		$('#copy-content-btn').hide();
		// Show modal
		$('#view-item-logs-details-modal-slide-in').modal('show');
	}
}

// OPEN MODAL - ADD NEW ACTION
$('body').on('click', '#outbound-actions-btn-add-row', function () {
	currentEditActionIndex = null;

	// Destroy Select2 to avoid conflicts
	$('#select-trigger-when-type, #select-webhook-method, #select-webhook-body-type').each(function () {
		if ($(this).data('select2')) $(this).select2('destroy');
	});

	resetActionModal();
	setSelectDefaults();
	initializeSelect2();
	initializeSortables();
	formValidator = null;

	$('#item-action-modal-slide-in').modal('show');
});

function setSelectDefaults() {
	$('#select-trigger-when-type').val('Pre-Request').trigger('change');
	$('#select-webhook-method').val('POST').trigger('change');
	$('#select-webhook-body-type').val('JSON').trigger('change');
}

function resetActionModal() {
	$('#form-action-create')[0].reset();

	// Reset counters properly
	actionCounters = {
		webhookHeaders: 1,
		webhookVariables: 1,
		emailVariables: 1,
		validationRules: 1
	};

	$('#customRadio1').prop('checked', true).trigger('change');

	// Remove extra rows but keep first row
	$('#webhook-headers-table tbody tr:gt(0)').remove();
	$('#webhook-variables-table tbody tr:gt(0)').remove();
	$('#email-variables-table tbody tr:gt(0)').remove();
	$('#outbound-action-validation-rules-table tbody tr:gt(0)').remove();

	resetAllFirstRows();
	$('#webhook-method-custom-row').hide();
	$('#webhook-method-custom-value').val('').prop('required', false);
	clearAllErrors();
}

function resetAllFirstRows() {
	const tables = [
		{ id: 'webhook-headers-table', prefix: 'webhook-headers' },
		{ id: 'webhook-variables-table', prefix: 'webhook-variables' },
		{ id: 'email-variables-table', prefix: 'email-variables' },
		{ id: 'outbound-action-validation-rules-table', prefix: 'validation' }
	];

	tables.forEach(table => {
		const $row = $('#' + table.id + ' tbody tr:first');
		if (!$row.length) return;

		$row.find('input[type="text"], textarea').val('');
		$row.find('input[type="checkbox"]').prop('checked', true);
		$row.find('select').prop('selectedIndex', 0);

		// Reset IDs and names for first row
		$row.find('[id],[for]').each(function () {
			const $el = $(this);
			const attr = $el.is('label') ? 'for' : 'id';
			const val = $el.attr(attr);
			if (val) {
				const newVal = val.replace(/-\d+$/, '-0');
				$el.attr(attr, newVal);
			}
		});

		// Reset names for form data
		$row.find('[name]').each(function () {
			const $el = $(this);
			const name = $el.attr('name');
			if (name) {
				const newName = name.replace(/\[\d*\]/g, '[0]');
				$el.attr('name', newName);
			}
		});
	});

	// Set specific defaults for validation table
	$('#outbound-action-validation-rules-table tbody tr:first')
		.find('select[name*="logical"]').val('AND').end()
		.find('select[name*="operations"]').val('==').end()
		.find('select[name*="then"]').val('SKIP');
}

function initializeSelect2() {
	['#select-trigger-when-type', '#select-webhook-method', '#select-webhook-body-type'].forEach(sel => {
		const $el = $(sel);
		if ($el.data('select2')) $el.select2('destroy');
		$el.select2({
			minimumResultsForSearch: Infinity,
			width: '100%',
			dropdownParent: $('#item-action-modal-slide-in'),
			allowClear: false
		});
	});
}

function initializeSortables() {
	['#webhook-headers-table', '#webhook-variables-table', '#email-variables-table'].forEach(id => {
		$(id + ' tbody').sortable({
			items: 'tr',
			cursor: 'pointer',
			axis: 'y',
			dropOnEmpty: false,
			start: function (e, ui) {
				ui.item.addClass('selected');
			},
			stop: function (e, ui) {
				ui.item.removeClass('selected');
			},
		})
	});
}

// TOGGLE WEBHOOK / EMAIL
function toggleActionSections() {
	const type = $('input[name="customRadio"]:checked').val();
	$('#webhook-section').toggle(type === 'Webhook');
	$('#email-section').toggle(type === 'Email');
}

$(document).on('change', 'input[name="customRadio"]', function () {
	$('.custom-control.custom-radio').removeClass('active');
	$(this).closest('.custom-control.custom-radio').addClass('active');
	toggleActionSections();
	clearAllErrors();
});

$('#select-webhook-method').on('change', function () {
	const isCustom = $(this).val() === 'Customize';
	$('#webhook-method-custom-row').toggle(isCustom);
	$('#webhook-method-custom-value').prop('required', isCustom);
});

toggleActionSections();


// DYNAMIC ROW ADDER (FIXED VERSION)
function addDynamicRow(tableId) {
	const $table = $('#' + tableId);
	const $template = $table.find('tbody tr:first').clone();

	// Get and increment the correct counter
	let counter;
	let counterType;
	if (tableId.includes('webhook-headers')) {
		counter = actionCounters.webhookHeaders++;
		counterType = 'webhookHeaders';
	} else if (tableId.includes('webhook-variables')) {
		counter = actionCounters.webhookVariables++;
		counterType = 'webhookVariables';
	} else if (tableId.includes('email-variables')) {
		counter = actionCounters.emailVariables++;
		counterType = 'emailVariables';
	} else if (tableId.includes('validation-rules')) {
		counter = actionCounters.validationRules++;
		counterType = 'validationRules';
	} else {
		counter = 0; // fallback
		counterType = null;
	}

	// Update all IDs, names, and for attributes
	$template.find('*').addBack().each(function () {
		const $el = $(this);

		// Update ID attributes
		if ($el.attr('id')) {
			$el.attr('id', $el.attr('id').replace(/-\d+$/, '-' + counter));
		}

		// Update name attributes for form data
		if ($el.attr('name')) {
			$el.attr('name', $el.attr('name').replace(/\[\d*\]/g, '[' + counter + ']'));
		}

		// Update label for attributes
		if ($el.is('label') && $el.attr('for')) {
			$el.attr('for', $el.attr('for').replace(/-\d+$/, '-' + counter));
		}
	});

	// Clear values
	$template.find('input[type="text"], textarea').val('');
	$template.find('select').not('[name*="logical"]').prop('selectedIndex', 0);
	$template.find('input[type="checkbox"]').prop('checked', true);

	// Set logical operator default for validation rows
	if (tableId.includes('validation-rules')) {
		$template.find('select[name*="logical"]').val('AND');
	}

	// Add delete handler with counter decrement
	$template.find('.btn-del').off('click').on('click', function () {
		const $rowToDelete = $(this).closest('tr');
		const $tableToDelete = $rowToDelete.closest('table');
		const tableIdToDelete = $tableToDelete.attr('id');

		// Don't allow deleting the last row in each table
		if ($tableToDelete.find('tbody tr').length <= 1) {
			return;
		}

		// Decrement the correct counter before removing
		if (tableIdToDelete.includes('webhook-headers')) {
			actionCounters.webhookHeaders--;
		} else if (tableIdToDelete.includes('webhook-variables')) {
			actionCounters.webhookVariables--;
		} else if (tableIdToDelete.includes('email-variables')) {
			actionCounters.emailVariables--;
		} else if (tableIdToDelete.includes('validation-rules')) {
			actionCounters.validationRules--;
		}

		$rowToDelete.remove();
	});

	$table.find('tbody').append($template);
}

// ADD ROW BUTTONS
$('body').on('click', '#webhook-headers-btn-add-row', () => addDynamicRow('webhook-headers-table'));
$('body').on('click', '#webhook-variables-btn-add-row', () => addDynamicRow('webhook-variables-table'));
$('body').on('click', '#email-variables-btn-add-row', () => addDynamicRow('email-variables-table'));
$('body').on('click', '#outbound-action-validation-rules-btn-add-row', () => addDynamicRow('outbound-action-validation-rules-table'));

// DELETE ROWS (FIXED VERSION)
$(document).on('click', '.webhook-headers-btn-del, .webhook-variables-btn-del, .email-variables-btn-del, .outbound-action-validation-rules-btn-del', function () {
	const $row = $(this).closest('tr');
	const $table = $row.closest('table');
	const tableId = $table.attr('id');

	// Don't allow deleting the last row in each table
	if ($table.find('tbody tr').length <= 1) {
		return;
	}

	// Decrement the correct counter before removing
	if (tableId.includes('webhook-headers')) {
		actionCounters.webhookHeaders--;
	} else if (tableId.includes('webhook-variables')) {
		actionCounters.webhookVariables--;
	} else if (tableId.includes('email-variables')) {
		actionCounters.emailVariables--;
	} else if (tableId.includes('validation-rules')) {
		actionCounters.validationRules--;
	}

	$row.remove();
});
// COLLECT DATA
function collectValidationRules() {
	const rules = [];
	$('#outbound-action-validation-rules-table tbody tr').each(function () {
		const $row = $(this);
		const original = $row.find('input[name*="original"]').val().trim();
		const column = $row.find('input[name*="column"]').val().trim();
		if (!original && !column) return;

		rules.push({
			logical: $row.find('select[name*="logical"]').val() || 'AND',
			original,
			operations: $row.find('select[name*="operations"]').val(),
			column,
			then: $row.find('select[name*="then"]').val()
		});
	});
	return rules;
}

function collectWebhookData() {
	const headers = [], variables = [];

	$('#webhook-headers-table tbody tr').each(function () {
		const $row = $(this);
		headers.push({
			enabled: $row.find('input[id*="status"]:not([id*="mask"])').is(':checked'),
			key: $row.find('input[name*="key"]').val().trim(),
			value: $row.find('input[name*="value"]').val().trim(),
			mask: $row.find('input[id*="mask-status"]').is(':checked'),
			description: $row.find('input[name*="description"]').val().trim()
		});
	});

	$('#webhook-variables-table tbody tr').each(function () {
		const $row = $(this);
		variables.push({
			enabled: $row.find('input[id*="status"]:not([id*="mask"])').is(':checked'),
			key: $row.find('input[name*="key"]').val().trim(),
			value: $row.find('input[name*="value"]').val().trim(),
			mask: $row.find('input[id*="mask-status"]').is(':checked'),
			description: $row.find('input[name*="description"]').val().trim()
		});
	});

	const method = $('#select-webhook-method').val() === 'Customize'
		? $('#webhook-method-custom-value').val().trim()
		: $('#select-webhook-method').val();

	return {
		url: $('#item-action-webhook-url').val().trim(),
		method,
		bodyType: $('#select-webhook-body-type').val(),
		content: $('#webhook-content').val(),
		headers,
		variables
	};
}

function collectEmailData() {
	const variables = [];
	$('#email-variables-table tbody tr').each(function () {
		const $row = $(this);
		variables.push({
			enabled: $row.find('input[id*="status"]:not([id*="mask"])').is(':checked'),
			key: $row.find('input[name*="key"]').val().trim(),
			value: $row.find('input[name*="value"]').val().trim(),
			mask: $row.find('input[id*="mask-status"]').is(':checked'),
			description: $row.find('input[name*="description"]').val().trim()
		});
	});

	return {
		to: $('#item-action-email-to').val().trim(),
		subject: $('#item-action-email-subject').val().trim(),
		content: $('#email-content').val(),
		variables
	};
}

// VALIDATE & SAVE
function validateActionForm() {
	clearAllErrors();
	let valid = true;

	if (!$('#item-action-description').val().trim()) {
		showFieldError($('#item-action-description'), 'Description is required');
		valid = false;
	}

	const type = $('input[name="customRadio"]:checked').val();
	if (type === 'Webhook') {
		if (!$('#item-action-webhook-url').val().trim()) {
			showFieldError($('#item-action-webhook-url'), 'Webhook URL is required');
			valid = false;
		}
		if ($('#select-webhook-method').val() === 'Customize' && !$('#webhook-method-custom-value').val().trim()) {
			showFieldError($('#webhook-method-custom-value'), 'Custom method is required');
			valid = false;
		}
	} else {
		if (!$('#item-action-email-to').val().trim()) {
			showFieldError($('#item-action-email-to'), 'Email To is required');
			valid = false;
		}
		if (!$('#item-action-email-subject').val().trim()) {
			showFieldError($('#item-action-email-subject'), 'Subject is required');
			valid = false;
		}
	}
	return valid;
}

function saveAction() {
	if (!validateActionForm()) return;

	const actionData = {
		id: currentEditActionIndex !== null
			? specifyHeaderJson[`row-${currentRowId}`].actionsArray[currentEditActionIndex].id
			: Date.now(),
		description: $('#item-action-description').val().trim(),
		triggerWhen: $('#select-trigger-when-type').val(),
		actionType: $('input[name="customRadio"]:checked').val(),
		validations: collectValidationRules(),
		status: true
	};

	if (actionData.actionType === 'Webhook') actionData.webhook = collectWebhookData();
	else actionData.email = collectEmailData();

	const actions = specifyHeaderJson[`row-${currentRowId}`].actionsArray;
	if (currentEditActionIndex !== null) {
		actions[currentEditActionIndex] = actionData;
	} else {
		actions.push(actionData);
	}

	renderActionsTable();
	$('#item-action-modal-slide-in').modal('hide');
}

// RENDER ACTIONS TABLE (FULLY WORKING)
function renderActionsTable() {
	const $tbody = $('#outbound-actions-table tbody');
	const actions = specifyHeaderJson[`row-${currentRowId}`]?.actionsArray || [];

	$tbody.empty();

	if (actions.length === 0) {
		$tbody.append('<tr><td colspan="6" class="text-center text-muted py-2">No actions added yet</td></tr>');
		return;
	}

	actions.forEach((action, index) => {
		let detailHTML = '';

		if (action.actionType === "Email") {
			detailHTML = `
				<div class="text-left">
					<strong>Email To:</strong> ${escapeHtml(action.email?.to || 'N/A')}<br>
					<strong>Subject:</strong> ${escapeHtml(action.email?.subject || 'N/A')}<br>
					${action.email?.content ? `<strong>Content:</strong> ${escapeHtml(action.email.content.substring(0, 100))}${action.email.content.length > 100 ? '...' : ''}<br>` : ''}
					${action.email?.variables?.length > 0 ? `<strong>Variables:</strong> ${action.email.variables.length} defined` : ''}
				</div>
			`;
		} else if (action.actionType === "Webhook") {
			detailHTML = `
				<div class="text-left">
					<strong>URL:</strong> ${escapeHtml(action.webhook?.url || 'N/A')}<br>
					<strong>Method:</strong> ${action.webhook?.method || 'POST'}<br>
					<strong>Body Type:</strong> ${action.webhook?.bodyType || 'JSON'}<br>
					${action.webhook?.content ? `<strong>Content:</strong> ${escapeHtml(action.webhook.content.substring(0, 100))}${action.webhook.content.length > 100 ? '...' : ''}<br>` : ''}
					${action.webhook?.headers?.length > 0 ? `<strong>Headers:</strong> ${action.webhook.headers.length} added<br>` : ''}
					${action.webhook?.variables?.length > 0 ? `<strong>Variables:</strong> ${action.webhook.variables.length} defined` : ''}
				</div>
			`;
		}

		const $row = $(`
			<tr data-index="${index}" class="action-row" style="cursor:pointer;">
				<td class="format-rules-icon text-center">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="16 18 22 12 16 6"></polyline>
						<polyline points="8 6 2 12 8 18"></polyline>
					</svg>
				</td>
				<td class="text-center">
					<div class="custom-control custom-checkbox">
						<input type="checkbox" class="custom-control-input action-status-checkbox" id="action-status-${index}" ${action.status !== false ? 'checked' : ''}>
						<label class="custom-control-label" for="action-status-${index}"></label>
					</div>
				</td>
				<td>${action.description || ''}</td>
				<td>${(action.triggerWhen || '').replace(/-/g, ' ')}</td>
				<td style="font-size: 0.85rem; line-height: 1.4;">${detailHTML}</td>
				<td class="text-center">
					<a href="javascript:void(0);" class="outbound-actions-btn-del btn btn-lg btn-del modal-button">
						<i data-feather="minus" class="font-medium-2"></i>
					</a>
				</td>
			</tr>
		`);
		$tbody.append($row);
	});

	feather.replace();
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

// ACTION STATUS TOGGLE
$(document).on('change', '.action-status-checkbox', function () {
	const index = $(this).closest('tr').data('index');
	const checked = $(this).is(':checked');
	specifyHeaderJson[`row-${currentRowId}`].actionsArray[index].status = checked;
});

// DELETE ACTION FROM TABLE
$(document).on('click', '.outbound-actions-btn-del', function (e) {
	e.stopPropagation();
	const index = parseInt($(this).closest('tr').data('index'));
	specifyHeaderJson[`row-${currentRowId}`].actionsArray.splice(index, 1);
	renderActionsTable();
});

// EDIT ACTION
$(document).on('click', '.action-row', function (e) {
	if ($(e.target).closest('.action-status-checkbox, .custom-control, .custom-control-label, .outbound-actions-btn-del').length) {
		return;
	}

	formValidator = null;

	const index = parseInt($(this).data('index'));
	currentEditActionIndex = index;
	const action = specifyHeaderJson[`row-${currentRowId}`].actionsArray[index];

	resetActionModal();
	initializeSelect2();
	initializeSortables();

	$('#item-action-description').val(action.description || '');
	$('#select-trigger-when-type').val(action.triggerWhen).trigger('change');

	if (action.actionType === 'Webhook') {
		$('#customRadio1').prop('checked', true).trigger('change');
		populateWebhookData(action.webhook || {});
	} else {
		$('#customRadio2').prop('checked', true).trigger('change');
		populateEmailData(action.email || {});
	}

	if (action.validations?.length > 0) {
		$('#outbound-action-validation-rules-table tbody tr:gt(0)').remove();
		action.validations.forEach((rule, i) => {
			if (i === 0) {
				populateValidationRow($('#outbound-action-validation-rules-table tbody tr:first'), rule);
			} else {
				addDynamicRow('outbound-action-validation-rules-table');
				populateValidationRow($('#outbound-action-validation-rules-table tbody tr:last'), rule);
			}
		});
	}

	$('#item-action-modal-slide-in').modal('show');
});

function populateValidationRow($row, rule) {
	$row.find('select[name*="logical"]').val(rule.logical || 'AND');
	$row.find('input[name*="original"]').val(rule.original || '');
	$row.find('select[name*="operations"]').val(rule.operations || '==');
	$row.find('input[name*="column"]').val(rule.column || '');
	$row.find('select[name*="then"]').val(rule.then || 'SKIP');
}

function populateWebhookData(data) {
	$('#item-action-webhook-url').val(data.url || '');
	$('#webhook-content').val(data.content || '');
	$('#select-webhook-body-type').val(data.bodyType || 'JSON').trigger('change');

	const method = data.method || 'POST';
	if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
		$('#select-webhook-method').val(method).trigger('change');
	} else {
		$('#select-webhook-method').val('Customize').trigger('change');
		$('#webhook-method-custom-value').val(method);
	}

	['headers', 'variables'].forEach(type => {
		const tableId = type === 'headers' ? 'webhook-headers-table' : 'webhook-variables-table';
		$(`#${tableId} tbody tr:gt(0)`).remove();
		(data[type] || []).forEach((item, i) => {
			if (i > 0) addDynamicRow(tableId);
			populateHeaderRow($(`#${tableId} tbody tr`).eq(i), item);
		});
	});
}

function populateEmailData(data) {
	$('#item-action-email-to').val(data.to || '');
	$('#item-action-email-subject').val(data.subject || '');
	$('#email-content').val(data.content || '');

	$('#email-variables-table tbody tr:gt(0)').remove();
	(data.variables || []).forEach((item, i) => {
		if (i > 0) addDynamicRow('email-variables-table');
		populateHeaderRow($('#email-variables-table tbody tr').eq(i), item);
	});
}

function populateHeaderRow($row, data) {
	$row.find('input[id*="-status"]:not([id*="-mask-status"])').prop('checked', data.enabled !== false);
	$row.find('input[name*="key"]').val(data.key || '');
	$row.find('input[name*="value"]').val(data.value || '');
	$row.find('input[id*="-mask-status"]').prop('checked', data.mask !== false);
	$row.find('input[name*="description"]').val(data.description || '');
}

// UTILITIES
function showFieldError($field, msg) {
	$field.addClass('is-invalid').after(`<div class="invalid-feedback d-block">${msg}</div>`);
	if ($('.is-invalid').length === 1) $field[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearAllErrors() {
	$('.form-control').removeClass('is-invalid');
	$('.invalid-feedback').remove();
}

$(document).on('input change', '.form-control', function () {
	$(this).removeClass('is-invalid').siblings('.invalid-feedback').remove();
});

$(document).on('click', '#action-item', saveAction);

$('#item-action-modal-slide-in').on('hidden.bs.modal', () => currentEditActionIndex = null);

// alert condition

if ($('#item-alert-condition-data-table').length) {
	itemAlertPerPage = 50;
	itemAlertCurrentPage = 1;
	itemAlertTable = $('#item-alert-condition-data-table').DataTable({
		aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
		iDisplayLength: itemAlertPerPage,
		pagingType: 'full_numbers',
		searching: true
	});

	$('body').on('click', '#item-alert-condition-data-table_paginate .paginate_button', async function () {
		itemAlertCurrentPage = $(this).attr('data-pageno');
		itemAlertTable.clear();
		itemAlertTable.destroy();
		itemAlertTable = $('#item-alert-condition-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: itemAlertPerPage,
			pagingType: 'full_numbers',
			searching: true,
		});
		await getAlertcondition(parseInt(itemAlertPerPage), parseInt(itemAlertCurrentPage), logsItemId);
	});

	$('body').on('change', '#item-alert-condition-data-table_length select', async function () {
		itemAlertPerPage = $('#item-alert-condition-data-table_length select').val();
		itemAlertCurrentPage = 1;
		itemAlertTable.clear();
		itemAlertTable.destroy();
		itemAlertTable = $('#item-alert-condition-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: itemAlertPerPage,
			pagingType: 'full_numbers',
			searching: true,
		});
		await getAlertcondition(parseInt(itemAlertPerPage), parseInt(itemAlertCurrentPage), logsItemId);
	});

	$('#select-security-level').select2({
		placeholder: 'Select Security',
		width: '100%'
	});


	$('#duration-unit').wrap('<div class="position-relative" style="width: 130px"></div>').select2()
	$('#group-by').wrap('<div class="position-relative" style="width: 130px"></div>').select2()

	$('#select-item-type').prop('disabled', true).trigger('change.select2');
	// Item dropdown logic
	$('#select-item-type').on('change', function () {
		if ($(this).val() === 'all') {
			$('#threshold-rules-section').show();
			$('#threshold-specific-item-section').hide();
		} else {
			$('#threshold-rules-section').hide();
			$('#threshold-specific-item-section').show();
		}
		refreshMonitorTypeDropdowns();
		$('#select-item-type').select2('close');
	});

	// Trigger condition logic
	$('#trigger-condition').on('change', function () {
		if ($(this).val() === 'for') {
			$('#times-wrapper').removeClass('d-none');
		} else {
			$('#times-wrapper').addClass('d-none');
		}
	});

	function togglePerItemRule() {
		const isPerItem = $('#group-by').val() === 'per_item';
		$('#per-item-wrapper').toggleClass('d-none', !isPerItem);
	}

	$('#group-by').on('change', function () {
		togglePerItemRule();
		refreshMonitorTypeDropdowns();
	});

	// On page load (NO trigger)
	$(document).ready(function () {
		togglePerItemRule();
	});

}

$('body').on('click', '#create-alert-condition-model', function () {
	itemPageAlert = true;
	clearFormFieldsConditions();
	getPolicy().then(response => { })
		.catch(error => {
			Swal.fire({
				title: 'Error!',
				text: error,
				icon: 'error',
				customClass: {
					confirmButton: 'btn btn-primary'
				},
				buttonsStyling: false,
				timer: 1200
			});
		});
	itemIdByItemPage = logsItemId;
	itemCompanyByItemPage = $('#select-item-company').val();
	itemProjectByItemPage = $('#select-item-project').val();
	$('#alert-condition-modal-slide-in').modal('show');
});

$('body').on('click', 'button.edit-alert-condition-model', function () {
	itemPageAlert = true;
	clearFormFieldsConditions();
	conditionId = $(this).attr('data-id');
	if (conditionId) {
		$('#condition-id').val(conditionId);
		$('#alert-modal-label-condition').text('Update Alert condition');
		$('#create-alert-condition').text('Update Alert condition');
		editAlertcondition(conditionId)
			.then(response => { })
			.catch(error => {
				Swal.fire({
					title: 'Error!',
					text: error,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			});
	}
	itemIdByItemPage = logsItemId;
	itemCompanyByItemPage = $('#select-item-company').val();
	itemProjectByItemPage = $('#select-item-project').val();
	$('#alert-condition-modal-slide-in').modal('show');
});

async function getAlertcondition(itemAlertPerPage, itemAlertCurrentPage, id) {
	$('#item-alert-condition-data-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty"><div class="tableloader"></div></td></tr>');
	itemAlertTable.clear()
	$.ajax({
		url: '/alerts/alert-conditions/list-by-item/' + id,
		method: 'POST',
		contentType: 'application/json',
		data: JSON.stringify({ page: parseInt(itemAlertCurrentPage), limit: parseInt(itemAlertPerPage), search: $('#alert-condition-data-table_filter input').val() }),
		success: function (response) {
			let counter = (parseInt(itemAlertCurrentPage) > 1) ? ((parseInt(itemAlertPerPage) * (parseInt(itemAlertCurrentPage) - 1)) + 1) : 1;
			let totalRecord = parseInt(response.total);

			if (response.data === undefined || response.data.length <= 0) {
				$('#item-alert-condition-data-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty">No data available in table</td></tr>');
			}

			$.each(response.data, function (index, data) {
				let $switchActive = '<div class="demo-inline-spacing"><div class="custom-control custom-switch custom-control-inline"><input type="checkbox" class="custom-control-input alert-condition-active-button is-active-button" id="custom-switch-' + index + '" data-id="' + data._id + '"';
				$switchActive += data.isActive ? 'checked ' : '';
				$switchActive += '/><label class="custom-control-label" for="custom-switch-' + index + '"></label></div></div>';

				let $buttonGroup = '<div class="btn-group" role="group" aria-label="Basic example">';
				$buttonGroup += '<a href="#" class="btn btn-outline-secondary" data-toggle="tooltip" title="Clone"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></a>';

				$buttonGroup += '<button type="button" class="btn btn-outline-secondary edit-alert-condition-model" data-toggle="tooltip" title="View" data-id="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>';

				$buttonGroup += '</div>';

				var row = itemAlertTable.row.add([
					counter++,
					data.name || '',
					data.description || '',
					data?.alertpolicy.name || '',
					data.createdBy,
					dateFormat(data.createdAt),
					dateFormat(data.updatedAt),
					$switchActive,
					$buttonGroup
				])

				itemAlertTable.row(row).draw(false);
			});

			$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
			let startEntry = (parseInt(itemAlertCurrentPage) == 1) ? 1 : ((parseInt(itemAlertPerPage) * (parseInt(itemAlertCurrentPage) - 1)) + 1);
			let endEntry = (parseInt(itemAlertCurrentPage) == 1) ? parseInt(itemAlertPerPage) : (parseInt(itemAlertPerPage) * parseInt(itemAlertCurrentPage));
			endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

			if (totalRecord == 0) {
				startEntry = 0;
			}

			let showpage = 'Showing ' + startEntry + ' to ' + endEntry + ' of ' + totalRecord + ' entries';
			$('body').find('#item-alert-condition-data-table_info').html(showpage);

			let dataDtIdx = 0;
			let paginationHtml = '';
			let firstDisable = (parseInt(itemAlertCurrentPage) == 1) ? 'disabled' : '';
			let lastDisable = (parseInt(itemAlertCurrentPage) == Math.ceil(totalRecord / parseInt(itemAlertPerPage))) ? 'disabled' : '';

			if (Math.ceil(totalRecord / parseInt(itemAlertPerPage)) > 0) {
				paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="item-alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="item-alert-condition-data-table_first_1" data-pageno="1">First</a>';
				dataDtIdx++;
				paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="item-alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="item-alert-condition-data-table_previous_1" data-pageno="' + (parseInt(itemAlertCurrentPage) - 1) + '">Previous</a>';
				paginationHtml += '<span>';
				dataDtIdx++;

				if (parseInt(itemAlertCurrentPage) > 2) {
					paginationHtml += '<a class="paginate_button" aria-controls="item-alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
					if (parseInt(itemAlertCurrentPage) > 3) {
						paginationHtml += '<span class="ellipsis">...</span>';
					}
					dataDtIdx++;
				}

				if ((parseInt(itemAlertCurrentPage) - 1) > 0) {
					paginationHtml += '<a class="paginate_button" aria-controls="item-alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(itemAlertCurrentPage) - 1) + '">' + (parseInt(itemAlertCurrentPage) - 1) + '</a>';
					dataDtIdx++;
				}

				paginationHtml += '<a class="paginate_button current" aria-controls="item-alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(itemAlertCurrentPage) + '">' + parseInt(itemAlertCurrentPage) + '</a>';
				dataDtIdx++;

				if ((parseInt(itemAlertCurrentPage) + 1) < Math.ceil(totalRecord / parseInt(itemAlertPerPage)) + 1) {
					paginationHtml += '<a class="paginate_button" aria-controls="item-alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(itemAlertCurrentPage) + 1) + '">' + (parseInt(itemAlertCurrentPage) + 1) + '</a>';
					dataDtIdx++;
				}

				if (parseInt(itemAlertCurrentPage) < Math.ceil(totalRecord / parseInt(itemAlertPerPage)) - 1) {
					if (((parseInt(itemAlertCurrentPage) + 3) < Math.ceil(totalRecord / parseInt(itemAlertPerPage)) + 1)) {
						paginationHtml += '<span class="ellipsis">...</span>';
					}
					paginationHtml += '<a class="paginate_button" aria-controls="item-alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(itemAlertPerPage)) + '">' + Math.ceil(totalRecord / parseInt(itemAlertPerPage)) + '</a>';
					dataDtIdx++;
				}

				paginationHtml += '</span>';
				paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="item-alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="item-alert-condition-data-table_next_1" data-pageno="' + (parseInt(itemAlertCurrentPage) + 1) + '">Next</a>';
				dataDtIdx++;
				paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="item-alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="item-alert-condition-data-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(itemAlertPerPage)) + '">Last</a>';
			}

			$('body').find('#item-alert-condition-data-table_paginate').html(paginationHtml);
		},
		error: function (xhr, status, error) {
			Swal.fire({
				title: 'Error!',
				text: xhr?.responseJSON?.message,
				icon: 'error',
				customClass: {
					confirmButton: 'btn btn-primary'
				},
				buttonsStyling: false,
				timer: 1200
			});
		}
	});
}