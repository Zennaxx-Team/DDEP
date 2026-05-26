let companyCodeCondition = '';
let conditionId = '';
let rulesRowCounter = 0;
let moniterRuleRowCounter = 0;
let variableHeaderRowCounter = 0;
let apiKeyNotifyCounter = 0;
let moniterRules = [];
let notifyData = [];
let selctedConditionChannel = 'webhook';
let flattenedOptions = [];
let item_list = [];
let groupCounter = 0;
let ruleCounter = 0;
let alertCurrentPage = 1;
let alertPerPage = 50;
let itemPageAlert = false;
let itemIdByItemPage;
let itemCompanyByItemPage;
let itemProjectByItemPage;
let isEditingRule = false;
let NotiFyCurrentEditActionIndex = null;
let notifyActionCounters = {
	webhookHeaders: 1,
	variables: 1
}
let hfInstance;
let hfSheetId;
let hfSheetName;

const fieldTypes = {
	// ================= VARIABLES =================
	variable_request: 'string',
	variable_response: 'string',
	variable_global: 'string',

	// ================= ENDPOINT =================
	endpoint_url: 'string',
	endpoint_row: 'string',
	endpoint_headers: 'string',
	endpoint_header: 'string',
	endpoint_querystrings: 'string',
	endpoint_querystring: 'string',
	endpoint_body: 'string',

	// ================= REQUEST =================
	request_headers: 'string',
	request_header: 'string',
	request_querystrings: 'string',
	request_querystring: 'string',
	request_body: 'string',
	request_transformedBody: 'string',

	// ================= RESPONSE =================
	response_time: 'number',
	response_httpstatuscode: 'number',
	response_headers: 'string',
	response_header: 'string',
	response_body: 'string',
	response_error: 'string',
	response_errormessage: 'string',

	// ================= ITEM =================
	item_responsetime: 'number',
	item_httpstatuscode: 'number',
	item_totalerror: 'number',

	// ================= AVERAGE =================
	average_responsetime: 'number',
	average_errorrate: 'number',
	average_throughput: 'number'
};


const moniterTypeOptions = [
	{
		text: 'Variables',
		children: [
			{ id: 'variable_request', text: 'Request Variable' },
			{ id: 'variable_response', text: 'Response Variable' },
			{ id: 'variable_global', text: 'Global Variable' },
		]
	},
	{
		text: 'Endpoint',
		children: [
			{ id: 'endpoint_url', text: 'URL' },
			{ id: 'endpoint_row', text: 'Row' },
			{ id: 'endpoint_headers', text: 'Headers' },
			{ id: 'endpoint_header', text: 'Header' },
			{ id: 'endpoint_querystrings', text: 'Querystrings' },
			{ id: 'endpoint_querystring', text: 'Querystring' },
			{ id: 'endpoint_body', text: 'Body' },
		]
	},
	{
		text: 'Request',
		children: [
			{ id: 'request_headers', text: 'Headers' },
			{ id: 'request_header', text: 'Header' },
			{ id: 'request_querystrings', text: 'Querystrings' },
			{ id: 'request_querystring', text: 'Querystring' },
			{ id: 'request_body', text: 'Body' },
			{ id: 'request_transformedBody', text: 'Transformed Body' }
		]
	},
	{
		text: 'Response',
		children: [
			{ id: 'response_time', text: 'Time (ms)' },
			{ id: 'response_httpstatuscode', text: 'HTTP Status Code' },
			{ id: 'response_headers', text: 'Headers' },
			{ id: 'response_header', text: 'Header' },
			{ id: 'response_body', text: 'Body' },
			{ id: 'response_error', text: 'Error' },
			{ id: 'response_errormessage', text: 'Error Message' }
		]
	},
	{
		text: 'Item',
		children: [
			{ id: 'item_responsetime', text: 'Response Time (ms)' },
			{ id: 'item_httpstatuscode', text: 'HTTP Status Code' },
			{ id: 'item_totalerror', text: 'Total Error' }

		]
	},
	{
		text: 'Average',
		children: [
			{ id: 'average_responsetime', text: 'Response Time (ms)' },
			{ id: 'average_errorrate', text: 'Error Rate' },
			{ id: 'average_throughput', text: 'Throughput' }
		]
	}
];

const monitorRuleDefaults = {
	// Variables
	variable_request: {
		monitor: '@reqIn[rowNumber]{variableName}',
		operation: 'Contains',
		value: ''
	},
	variable_response: {
		monitor: '@resIn[rowNumber]{variableName}',
		operation: 'Contains',
		value: ''
	},
	variable_global: {
		monitor: '@global{variableName}',
		operation: 'Contains',
		value: ''
	},

	// Endpoint
	endpoint_url: {
		monitor: '@endpoint.url',
		operation: 'Contains',
		value: ''
	},
	endpoint_row: {
		monitor: '@endpoint.row',
		operation: '=',
		value: '0'
	},
	endpoint_headers: {
		monitor: '@endpoint.headers',
		operation: 'Contains',
		value: ''
	},
	endpoint_header: {
		monitor: '@endpoint.header{variableName}',
		operation: '=',
		value: ''
	},
	endpoint_querystrings: {
		monitor: '@endpoint.querystrings',
		operation: 'Contains',
		value: ''
	},
	endpoint_querystring: {
		monitor: '@endpoint.querystring{variableName}',
		operation: '=',
		value: ''
	},
	endpoint_body: {
		monitor: '@endpoint.body',
		operation: 'Contains',
		value: ''
	},

	// Request
	request_headers: {
		monitor: '@req.headers',
		operation: 'Contains',
		value: ''
	},
	request_header: {
		monitor: '@req.header{variableName}',
		operation: '=',
		value: ''
	},
	request_querystrings: {
		monitor: '@req.querystrings',
		operation: 'Contains',
		value: ''
	},
	request_querystring: {
		monitor: '@req.querystring{variableName}',
		operation: '=',
		value: ''
	},
	request_body: {
		monitor: '@req.body',
		operation: 'Contains',
		value: ''
	},
	request_transformedBody: {
		monitor: '@req.transformedBody',
		operation: 'Contains',
		value: ''
	},

	// Response
	response_time: {
		monitor: '@res.timeMs',
		operation: '>',
		value: '5000'
	},
	response_httpstatuscode: {
		monitor: '@res.httpStatusCode',
		operation: '<>',
		value: '200'
	},
	response_headers: {
		monitor: '@res.headers',
		operation: 'Contains',
		value: ''
	},
	response_header: {
		monitor: '@res.header{variableName}',
		operation: '=',
		value: ''
	},
	response_body: {
		monitor: '@res.body',
		operation: 'Contains',
		value: ''
	},
	response_error: {
		monitor: '@res.error',
		operation: '=',
		value: 'true'
	},
	response_errormessage: {
		monitor: '@res.errorMessage',
		operation: 'Contains',
		value: ''
	},

	// Item (Scheduler)
	item_responsetime: {
		monitor: '@item.resTimeMs',
		operation: '>',
		value: '5000'
	},
	item_httpstatuscode: {
		monitor: '@item.httpStatusCode',
		operation: '<>',
		value: '200'
	},
	item_totalerror: {
		monitor: '@item.totalError',
		operation: '>',
		value: '0'
	},

	// Average
	average_responsetime: {
		monitor: '@avg.resTimeMs',
		operation: '>',
		value: '10000'
	},
	average_errorrate: {
		monitor: '@avg.errorRate',
		operation: '>',
		value: '20'
	},
	average_throughput: {
		monitor: '@avg.throughput',
		operation: '>',
		value: '500'
	},
};


const logicalOpertionOptions = [
	{ id: 'AND', text: 'AND' },
	{ id: 'OR', text: 'OR' },
];

const compairisonOptions = [
	{ id: '=', text: '=' },
	{ id: '>', text: '>' },
	{ id: '>=', text: '>=' },
	{ id: '<=', text: '<=' },
	{ id: '<>', text: '<>' },
	{ id: 'Contains', text: 'Contains' },
	{ id: 'Not Contains', text: 'Not Contains' },
	{ id: 'In', text: 'In' },
	{ id: 'Not In', text: 'Not In' },
];

moniterTypeOptions.forEach(group => {
	flattenedOptions.push({ text: group.text, disabled: true }); // Add optgroup label
	group.children.forEach(child => {
		flattenedOptions.push({ id: child.id, text: child.text });
	});
});

$(document).ready(async function () {
	if ($('#alert-condition-data-table').length) {
		toggleIconState('addIcon', true, "condition");
	}

	$('body').on('click', '.condition', function () {
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
		itemPageAlert = false;
		lockDropdowns(false);
		$('#alert-condition-modal-slide-in').modal('show');
	});

	if ($('#alert-condition-data-table').length) {
		alertPerPage = 50;
		alertCurrentPage = 1;
		table = $('#alert-condition-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: alertPerPage,
			pagingType: 'full_numbers',
			searching: true,
			initComplete: function () {
				$('#alert-condition-data-table_filter input').unbind().bind('keyup', function (e) {
					if (e.keyCode === 13) {
						alertCurrentPage = 1;
						getAlertcondition(parseInt(alertPerPage), parseInt(alertCurrentPage));
					}
				});
			}
		});

		getAlertcondition(parseInt(alertPerPage), parseInt(alertCurrentPage));

		$('body').on('click', '#alert-condition-data-table_paginate .paginate_button', function () {
			alertCurrentPage = $(this).attr('data-pageno');
			table.clear();
			table.destroy();
			table = $('#alert-condition-data-table').DataTable({
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: alertPerPage,
				pagingType: 'full_numbers',
				searching: true,
			});
			getAlertcondition(parseInt(alertPerPage), parseInt(alertCurrentPage));
		});

		$('body').on('change', '#alert-condition-data-table_length select', function () {
			alertPerPage = $('#alert-condition-data-table_length select').val();
			alertCurrentPage = 1;
			table.clear();
			table.destroy();
			table = $('#alert-condition-data-table').DataTable({
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: alertPerPage,
				pagingType: 'full_numbers',
				searching: true,
			});
			getAlertcondition(parseInt(alertPerPage), parseInt(alertCurrentPage));
		});

		function getAlertcondition(alertPerPage, alertCurrentPage) {
			$('#alert-condition-data-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

			$.ajax({
				url: '/alerts/alert-conditions/list',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ page: parseInt(alertCurrentPage), limit: parseInt(alertPerPage), search: $('#alert-condition-data-table_filter input').val() }),
				beforeSend: function () {
					table.clear().draw();
				},
				success: function (response) {
					let counter = (parseInt(alertCurrentPage) > 1) ? ((parseInt(alertPerPage) * (parseInt(alertCurrentPage) - 1)) + 1) : 1;
					let totalRecord = parseInt(response.total);

					if (response.data === undefined || response.data.length <= 0) {
						$('#alert-condition-data-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty">No data available in table</td></tr>');
					}

					$.each(response.data, function (index, data) {
						let $switchActive = '<div class="demo-inline-spacing"><div class="custom-control custom-switch custom-control-inline"><input type="checkbox" class="custom-control-input alert-condition-active-button is-active-button" id="custom-switch-' + index + '" data-id="' + data._id + '"';
						$switchActive += data.isActive ? 'checked ' : '';
						$switchActive += '/><label class="custom-control-label" for="custom-switch-' + index + '"></label></div></div>';

						let $buttonGroup = '<div class="btn-group" role="group" aria-label="Basic example">';
						$buttonGroup += '<a href="#" class="btn btn-outline-secondary" data-toggle="tooltip" title="Clone"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></a>';

						$buttonGroup += '<button type="button" class="btn btn-outline-secondary alert-condition-model" data-toggle="tooltip" title="View" data-id="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>';

						$buttonGroup += '</div>';

						var row = table.row.add([
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

						table.row(row).draw(false);
					});

					$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
					let startEntry = (parseInt(alertCurrentPage) == 1) ? 1 : ((parseInt(alertPerPage) * (parseInt(alertCurrentPage) - 1)) + 1);
					let endEntry = (parseInt(alertCurrentPage) == 1) ? parseInt(alertPerPage) : (parseInt(alertPerPage) * parseInt(alertCurrentPage));
					endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

					if (totalRecord == 0) {
						startEntry = 0;
					}

					let showpage = 'Showing ' + startEntry + ' to ' + endEntry + ' of ' + totalRecord + ' entries';
					$('body').find('#alert-condition-data-table_info').html(showpage);

					let dataDtIdx = 0;
					let paginationHtml = '';
					let firstDisable = (parseInt(alertCurrentPage) == 1) ? 'disabled' : '';
					let lastDisable = (parseInt(alertCurrentPage) == Math.ceil(totalRecord / parseInt(alertPerPage))) ? 'disabled' : '';

					if (Math.ceil(totalRecord / parseInt(alertPerPage)) > 0) {
						paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="alert-condition-data-table_first_1" data-pageno="1">First</a>';
						dataDtIdx++;
						paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="alert-condition-data-table_previous_1" data-pageno="' + (parseInt(alertCurrentPage) - 1) + '">Previous</a>';
						paginationHtml += '<span>';
						dataDtIdx++;

						if (parseInt(alertCurrentPage) > 2) {
							paginationHtml += '<a class="paginate_button" aria-controls="alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
							if (parseInt(alertCurrentPage) > 3) {
								paginationHtml += '<span class="ellipsis">...</span>';
							}
							dataDtIdx++;
						}

						if ((parseInt(alertCurrentPage) - 1) > 0) {
							paginationHtml += '<a class="paginate_button" aria-controls="alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(alertCurrentPage) - 1) + '">' + (parseInt(alertCurrentPage) - 1) + '</a>';
							dataDtIdx++;
						}

						paginationHtml += '<a class="paginate_button current" aria-controls="alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(alertCurrentPage) + '">' + parseInt(alertCurrentPage) + '</a>';
						dataDtIdx++;

						if ((parseInt(alertCurrentPage) + 1) < Math.ceil(totalRecord / parseInt(alertPerPage)) + 1) {
							paginationHtml += '<a class="paginate_button" aria-controls="alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(alertCurrentPage) + 1) + '">' + (parseInt(alertCurrentPage) + 1) + '</a>';
							dataDtIdx++;
						}

						if (parseInt(alertCurrentPage) < Math.ceil(totalRecord / parseInt(alertPerPage)) - 1) {
							if (((parseInt(alertCurrentPage) + 3) < Math.ceil(totalRecord / parseInt(alertPerPage)) + 1)) {
								paginationHtml += '<span class="ellipsis">...</span>';
							}
							paginationHtml += '<a class="paginate_button" aria-controls="alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(alertPerPage)) + '">' + Math.ceil(totalRecord / parseInt(alertPerPage)) + '</a>';
							dataDtIdx++;
						}

						paginationHtml += '</span>';
						paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="alert-condition-data-table_next_1" data-pageno="' + (parseInt(alertCurrentPage) + 1) + '">Next</a>';
						dataDtIdx++;
						paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="alert-condition-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="alert-condition-data-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(alertPerPage)) + '">Last</a>';
					}

					$('body').find('#alert-condition-data-table_paginate').html(paginationHtml);
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

		$('#select-security-level').select2({
			placeholder: 'Select Security',
			width: '100%'
		});


		$('#duration-unit').wrap('<div class="position-relative" style="width: 130px"></div>').select2()
		$('#group-by').wrap('<div class="position-relative" style="width: 130px"></div>').select2()

		// Item dropdown logic
		$('#select-item-type').on('change', function () {
			if ($(this).val() === 'all') {
				$('#threshold-rules-section').show();
				$('#threshold-specific-item-section').hide();
			} else {
				$('#threshold-rules-section').hide();
				$('#threshold-specific-item-section').show();
			}
			if (!isEditingRule) {
				refreshMonitorTypeDropdowns();
			}
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
			if (!isEditingRule) {
				refreshMonitorTypeDropdowns();
			}
		});

		// On page load (NO trigger)
		$(document).ready(function () {
			togglePerItemRule();
		});

	}

	$('body').on('change', '.alert-condition-active-button', function () {
		$this = $(this);
		Swal.fire({
			title: 'Are you sure?',
			text: ($this.is(':checked')) ? `You want to active this alert condition?` : `You want to inactive this alert condition?`,
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
				const alertconditionId = $this.data('id');

				$.ajax({
					url: '/alerts/alert-conditions/status/' + alertconditionId,
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

	$('body').on('click', 'button.alert-condition-model', function () {
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
		itemPageAlert = false;
		lockDropdowns(false);
		$('#alert-condition-modal-slide-in').modal('show');
	});

	if ($('#form-condition-create').length) {
		formValidator = $('#form-condition-create').validate({
			rules: {
				'condition-name': {
					required: true
				},
				'select-policy': {
					required: true
				}
			},
			messages: {
				'condition-name': {
					required: 'Please enter the condition Name!'
				},
				'select-policy': {
					required: 'Please select Policy!'
				}
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
			$('#form-condition-create').find('button[type="submit"]').prop('disabled', true);

			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({ 'display': 'block' });

			const data = {
				name: $('#condition-name').val(),
				policyId: $('#select-policy').val(),
				moniterRules: moniterRules || [],
				description: $('#condition-description').val(),
				isActive: $('#is-active').is(':checked') ? 1 : 0,
				companyCode: companyCodeCondition
			};

			const id = $('#condition-id').val();
			const apiUrl = (!id) ? '/alerts/alert-conditions/create' : '/alerts/alert-conditions/update/' + id;
			const method = (!id) ? 'POST' : 'PUT';

			$.ajax({
				url: apiUrl,
				method: method,
				contentType: 'application/json',
				data: JSON.stringify(data),
				success: function (response) {
					if (response.status === 1) {
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

						window.location.reload();
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
					$('#form-condition-create').find('button[type="submit"]').prop('disabled', false);
				},
				error: function (xhr, status, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });
					$('#form-condition-create').find('button[type="submit"]').prop('disabled', false);

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
		}

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

		editAlertcondition()
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
});

$('body').on('select2:open', '#select-policy', function () {
	const dropdown = $(this).data('select2').dropdown.$search[0].parentElement;

	// Check if the button is already present
	if (!$(dropdown).find('.add-new-item-btn').length) {
		$(dropdown).append(`
			<button style="width: 100%; margin-top:10px" type="button" class="btn btn-primary add-new-item-btn" onClick="createPolicy()">Create Policy</button>
		`);
	}
});

function createPolicy() {
	clearErrors();
	$('#form-policy-create')[0].reset();
	$('#policy-id').val('');
	$('#alert-modal-label').text('Create Alert Policy');
	$('#create-alert-policy').text('Create Alert Policy');
	$('#is-active').prop('checked', true);
	isMasterPageAlertPolicy = false;
	$('#moniter-rule-body').empty();
	$('#alert-policy-modal-slide-in').modal('show');
}

async function updatePolicyOptions() {
	let $selectPolicy = $('#select-policy')
	let currentValue = $selectPolicy.val();

	getPolicy().then(response => {
		$selectPolicy.val(currentValue).trigger('change');
	})
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

	$('#alert-policy-modal-slide-in').modal('hide');
}

function getPolicy() {
	return new Promise((resolve, reject) => {
		$.ajax({
			url: '/alerts/alert-policies/all',
			method: 'GET',
			success: function (response) {
				if (response.status == 1) {
					const selectPolicy = document.getElementById('select-policy');
					selectPolicy.innerHTML = '<option value="">-- Please Select --</option>';

					response.data.forEach(item => {
						const option = document.createElement('option');
						option.value = item._id;
						option.textContent = item.name;
						option.setAttribute('data-name', item.name);

						selectPolicy.appendChild(option);
					});

					resolve(response);
				} else {
					reject(response.message);
				}
			},
			error: function (xhr, status, error) {
				reject(xhr?.responseJSON?.message || 'An error occurred');
			}
		});
	});
}

function editAlertcondition() {
	return new Promise((resolve, reject) => {
		const id = $('#condition-id').val();
		if (id) {
			$.ajax({
				url: '/alerts/alert-conditions/get/' + id,
				method: 'GET',
				success: function (response) {
					if (response.status === 1) {
						const data = response?.data;

						$('#condition-name').val(data.name);
						$('#condition-description').val(data.description);
						$('#select-policy').val(data.policyId).trigger('change');
						companyCodeCondition = data.companyCode;

						if (data.isActive) {
							$('#is-active').prop('checked', true);
						} else {
							$('#is-active').prop('checked', false);
						}

						moniterRules = data.moniterRules || [];
						moniterRuleRowCounter = 0;
						bindMoniterTable(moniterRules);
						resolve(response);
					} else {
						reject(response.message);
					}

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });
				},
				error: function (xhr, status, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });

					reject(xhr?.responseJSON?.message || 'An error occurred');
				}
			});
		}
	});
}

function clearFormFieldsConditions() {
	clearErrors();
	moniterRules = [];
	$('#moniter-rule-table tbody').empty();
	$('#form-condition-create')[0].reset();
	$('#condition-id').val('');
	$('#alert-modal-label-condition').text('Create Alert condition');
	$('#create-alert-condition').text('Create Alert condition');
	$('#is-active').prop('checked', true);
}

function clearErrorForElement(element) {
	const $input = $(element);
	$input.closest('.form-group').find('.help-block').remove();
	$input.removeClass('error');
}

function showError($input, message) {
	const errorElement = $('<div class="help-block animation-slideDown error"></div>');
	errorElement.text(message);
	$input.addClass('error');
	$input.closest('.form-group').append(errorElement);
}

function bindMoniterTable(data) {
	const $tbody = $('#moniter-rule-body');
	$tbody.empty();
	data.forEach((rule) => {
		const row = `<tr data-id="${moniterRuleRowCounter}"> id="prop-moniter-rules-table-row-${moniterRuleRowCounter}"
			<td>${rule.name}</td>
			<td>${rule.description}</td>
			<td>${rule.notifyMethod}</td>
			<td>${moment(rule.createdAt).format("YYYY-MM-DD HH:mm:ss.SSS")}</td>
			<td>${moment(rule.updatedAt).format("YYYY-MM-DD HH:mm:ss.SSS")}</td>
			<td class="text-center">
				<a href="javascript:void(0);" type="button" class="btn btn-lg btn-del modal-button edit-moniter-rule-row">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit font-medium-2">
						<path d="M17 3l4 4-11 11H3v-4L17 3z"></path>
					</svg>
				</a>
				
				<a href="javascript:void(0);" type="button" class="btn btn-lg btn-del modal-buttond delete-moniter-rule-row">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2">
						<line x1="5" y1="12" x2="19" y2="12"></line>
					</svg>
				</a>
			</td>
		</tr>`;
		$tbody.append(row);
		moniterRuleRowCounter++;
	});
}

function togglePerItemRuleByValue(groupByValue) {
	const isPerItem = groupByValue === 'per_item';
	$('#per-item-wrapper').toggleClass('d-none', !isPerItem);
}

// ======= Utility Functions =======
function resetSelect($select, placeholder = '-- Please Select --') {
	$select.empty().append(`<option value="">${placeholder}</option>`);
}

function setAllProjectsVisible(isVisible) {
	$('#select-project-type option[value="all"]').toggle(isVisible);
}

function setAllItemsVisible(isVisible) {
	$('#select-item-type option[value="all"]').toggle(isVisible);
}

function resetProjectAndItemToAll() {
	$('#select-project-type').val('all').trigger('change');
	$('#select-item-type').val('all').trigger('change');
}

async function initializeAndFetchData() {
	await companyList();
	$('#select-company-type').val('all').trigger('change');
}

// ======= Fetch Company List =======
async function companyList() {
	try {
		const response = await getAllCompanies();
		if (response.status === 1) {
			const $select = $('#select-company-type');
			resetSelect($select);

			$('<option>', { value: 'all', text: 'All Companies' }).appendTo($select);

			response.data.forEach(item => {
				$('<option>', { value: item._id, text: item.name }).appendTo($select);
			});
		}
	} catch (error) {
		console.error('Error fetching companies:', error);
	}
}

// ======= Company Change =======
$('#select-company-type').on('change', async function () {
	const companyValue = $(this).val();

	resetSelect($('#select-project-type'));
	resetSelect($('#select-item-type'));

	if (companyValue === 'all') {
		// All Companies
		await projectListForAll();
		setAllProjectsVisible(true);    // show "All Projects"
		setAllItemsVisible(true);       // show "All Items"

		// Reset selects WITHOUT triggering change event
		$('#select-project-type').val('all');
		$('#select-item-type').val('all');
		// Trigger once at the end to fetch items
		$('#select-project-type').trigger('change');
		$('#threshold-rules-section').show();
		$('#threshold-specific-item-section').hide();
		refreshMonitorTypeDropdowns();
	} else {
		// Specific Company
		await projectListForCompany(companyValue);
		setAllProjectsVisible(false);   // hide "All Projects"
		setAllItemsVisible(false);      // hide "All Items"

		// Reset project to first actual project WITHOUT trigger
		const $selectProject = $('#select-project-type');
		$selectProject.prop('selectedIndex', 1); // skip default placeholder, go to first project
		// Trigger once to fetch items
		$selectProject.trigger('change');
		$('#threshold-rules-section').hide();
		$('#threshold-specific-item-section').show();
		refreshMonitorTypeDropdowns();
	}
});

// ======= Project Change =======
$('#select-project-type').on('change', async function () {
	const projectValue = $(this).val();
	const companyValue = $('#select-company-type').val();

	const $selectItem = $('#select-item-type');
	resetSelect($selectItem);

	// Only show "All Items" if Company=All AND Project=All
	if (companyValue === 'all' && projectValue === 'all') {
		$('<option>', { value: 'all', text: 'All Items', selected: true }).appendTo($selectItem);
		$('#threshold-rules-section').show();
		$('#threshold-specific-item-section').hide();
		refreshMonitorTypeDropdowns();
	} else {
		$('#threshold-rules-section').hide();
		$('#threshold-specific-item-section').show();
		refreshMonitorTypeDropdowns();
	}

	// Fetch items for selected company/project
	const response = await getAllItemList(companyValue, projectValue);
	if (response.status === 1) {
		response.data.forEach(item => {
			$('<option>', { value: item._id, text: item.ItemName }).appendTo($selectItem);
		});

		if (companyValue !== 'all' || projectValue !== 'all') {
			$selectItem.prop('selectedIndex', 0);
		}
	}
});

// ======= Fetch Project Lists =======
async function projectListForAll() {
	const response = await getAllProjects();
	if (response.status === 1) {
		const $select = $('#select-project-type');
		resetSelect($select);

		$('<option>', { value: 'all', text: 'All Projects', selected: true }).appendTo($select);
		$('<option>', { value: ' ', text: 'Default', 'data-name': 'Default' }).appendTo($select);

		response.data.forEach(item => {
			$('<option>', { value: item._id, text: item.name }).appendTo($select);
		});
	}
}

async function projectListForCompany(companyId) {
	const response = await getAllCompanyProjects(companyId);
	if (response.status === 1) {
		const $select = $('#select-project-type');
		resetSelect($select);

		$('<option>', { value: ' ', text: 'Default' }).appendTo($select);

		response.data
			.filter(p => p.companyId === companyId)
			.forEach(item => {
				$('<option>', { value: item._id, text: item.name }).appendTo($select);
			});
	}
}

// ======= Fetch Item List =======
async function itemList(companyId, projectId) {
	const response = await getAllItemList(companyId, projectId);
	if (response.status === 1) {
		const $select = $('#select-item-type');
		resetSelect($select);

		// Add "All Items" only when Company=All AND Project=All
		if (companyId === 'all' && projectId === 'all') {
			$('<option>', { value: 'all', text: 'All Items', selected: true }).appendTo($select);
		}

		response.data.forEach(item => {
			$('<option>', { value: item._id, text: item.ItemName }).appendTo($select);
		});

		$selectItem.prop('selectedIndex', 0).trigger('change');
	}
}

function lockDropdowns(lock = true) {
	$('#select-company-type').prop('disabled', lock);
	$('#select-project-type').prop('disabled', lock);
	$('#select-item-type').prop('disabled', lock);
}

$('#moniter-rule-headers-btn-add-row').click(async function () {
	formValidator = null;
	clearErrors();
	notifyData = [];
	$('#form-moniter-rule-create')[0].reset();
	$('#notify-table tbody').empty();
	$('#query-builder-root').empty();
	resetVariablesTable();

	await companyList();
	await waitForOptions($('#select-company-type'), 2);

	const companyId = itemPageAlert ? itemCompanyByItemPage : 'all';
	$('#select-company-type').val(companyId).trigger('change.select2');

	await new Promise(resolve => setTimeout(resolve, 200));

	if (itemPageAlert) {
		await projectListForCompany(companyId);
		setAllProjectsVisible(false);
		setAllItemsVisible(false);
	} else {
		await projectListForAll();
		setAllProjectsVisible(true);
		setAllItemsVisible(true);
	}

	await waitForOptions($('#select-project-type'), 1);

	const projectId = itemPageAlert ? itemProjectByItemPage : 'all';
	$('#select-project-type').val(projectId).trigger('change.select2');

	await new Promise(resolve => setTimeout(resolve, 200));

	const itemResponse = await getAllItemList(companyId, projectId);
	if (itemResponse.status === 1) {
		const $selectItem = $('#select-item-type');
		resetSelect($selectItem);

		if (!itemPageAlert) {
			$('<option>', { value: 'all', text: 'All Items' }).appendTo($selectItem);
		}

		itemResponse.data.forEach(item => {
			$('<option>', { value: item._id, text: item.ItemName }).appendTo($selectItem);
		});

		const itemId = itemPageAlert ? itemIdByItemPage : 'all';
		$selectItem.val(itemId).trigger('change.select2');

		if (companyId === 'all' && projectId === 'all' && itemId === 'all') {
			$('#threshold-rules-section').show();
			$('#threshold-specific-item-section').hide();
		} else {
			$('#threshold-rules-section').hide();
			$('#threshold-specific-item-section').show();
		}
	}

	lockDropdowns(itemPageAlert === true);

	$('#select-security-level').val('').trigger('change');
	$('#duration-value').val('');
	$('#duration-unit').val('minutes').trigger('change.select2');
	$('#group-by').val('per_item').trigger('change.select2');
	$('#per-item-times').val(1);

	togglePerItemRuleByValue('per_item');

	const rootGroupId = createGroup();
	addRule(rootGroupId);

	sortableTable();
	$('#moniter-rule-modal-slide-in').removeData('edit-id');
	$('#moniter-rule-modal-slide-in').modal('show');
});

const waitForOptions = ($select, minOptions = 1, timeout = 2500) => {
	return new Promise(resolve => {
		const startTime = Date.now();

		const check = () => {
			if ($select.find('option').length >= minOptions) {
				resolve(true);
			} else if (Date.now() - startTime < timeout) {
				setTimeout(check, 50);
			} else {
				resolve(false);
			}
		};
		check();
	});
};

function sortableTable() {
	$('#notify-table tbody').sortable({
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
		update: function () {
			const reorderedData = [];
			$('#notify-table tbody tr').each(function () {
				const index = parseInt($(this).data('notify-id'), 10);
				if (!isNaN(index) && notifyData[index] !== undefined) {
					reorderedData.push(notifyData[index]);
				}
			});
			if (reorderedData.length === notifyData.length) {
				notifyData = reorderedData;
			}
		}
	});
	$('#variables-table tbody').sortable({
		items: 'tr',
		cursor: 'pointer',
		axis: 'y',
		dropOnEmpty: false,
		start: function (e, ui) {
			ui.item.addClass('selected');
		},
		stop: function (e, ui) {
			ui.item.removeClass('selected');
		}
	});
}

async function bindCompanyProjectItemForEdit(ruleData) {

	const companyId = ruleData.companyId || 'all';
	const projectId = ruleData.projectId || (companyId === 'all' ? 'all' : ' ');
	const itemId = ruleData.itemType || 'all';

	// Step 1: Load and set companies
	await companyList();
	await waitForOptions($('#select-company-type'), 2);
	$('#select-company-type').val(companyId).trigger('change.select2');


	// Wait a bit for change handler
	await new Promise(resolve => setTimeout(resolve, 200));

	// Step 2: Load projects based on company
	if (companyId === 'all') {
		await projectListForAll();
		setAllProjectsVisible(true);
		setAllItemsVisible(true);
	} else {
		await projectListForCompany(companyId);
		setAllProjectsVisible(false);
		setAllItemsVisible(false);
	}

	await waitForOptions($('#select-project-type'), 1);

	// Check if option exists before setting
	const projectExists = $(`#select-project-type option[value="${projectId}"]`).length > 0;

	$('#select-project-type').val(projectId).trigger('change.select2');

	// Wait a bit for change handler
	await new Promise(resolve => setTimeout(resolve, 200));

	// Step 3: Load items based on company and project
	const itemResponse = await getAllItemList(companyId, projectId);

	if (itemResponse.status === 1) {
		const $selectItem = $('#select-item-type');
		resetSelect($selectItem);

		// Add "All Items" only if both are 'all'
		if (companyId === 'all' && projectId === 'all') {
			$('<option>', { value: 'all', text: 'All Items' }).appendTo($selectItem);
		}

		itemResponse.data.forEach(item => {
			$('<option>', { value: item._id, text: item.ItemName }).appendTo($selectItem);
		});

		// Check if item option exists
		const itemExists = $(`#select-item-type option[value="${itemId}"]`).length > 0;

		if (itemId !== 'all') {
			$('#threshold-rules-section').hide();
		}

		$selectItem.val(itemId).trigger('change.select2');
	}

	if (itemPageAlert === true) {
		lockDropdowns(true);
	} else {
		lockDropdowns(false);
	}
}

$('#moniter-rule-body').on('click', '.edit-moniter-rule-row', async function () {
	try {

		clearErrors();
		isEditingRule = true;
		formValidator = null;

		const rowIndex = $(this).closest('tr').index();
		const ruleData = moniterRules[rowIndex];

		// === 1. FULL RESET OF MODAL ===
		$('#form-moniter-rule-create')[0].reset();
		$('#notify-table tbody').empty();
		$('#query-builder-root').empty();
		notifyData = [];
		resetVariablesTable();

		// === 2. BIND COMPANY/PROJECT/ITEM (NO TRIGGERS) ===
		await bindCompanyProjectItemForEdit(ruleData);

		// === 3. Set basic fields ===
		$('#rule-name').val(ruleData.name || '');
		$('#rule-description').val(ruleData.description || '');
		$('#select-security-level').val(ruleData.securityLevel || '').trigger('change');

		// === 4. Threshold fields ===
		if (ruleData.threshold) {
			$('#duration-value').val(ruleData.threshold.durationValue || '');
			$('#duration-unit').val(ruleData.threshold.durationUnit || 'minutes').trigger('change.select2');
			$('#group-by').val(ruleData.threshold.groupBy || 'per_item').trigger('change.select2');
			$('#per-item-times').val(ruleData.threshold.times || 1);
			togglePerItemRuleByValue(ruleData.threshold.groupBy || 'per_item');
		} else {
			$('#group-by').val('per_item').trigger('change.select2');
			$('#per-item-times').val(1);
			togglePerItemRuleByValue('per_item');
		}

		// === 5. Variables & Notify ===
		if (ruleData.variables && Array.isArray(ruleData.variables)) {
			loadVariablesIntoTable(ruleData.variables);
		} else {
			resetVariablesTable();
		}

		notifyData = ruleData.notify || [];
		$('#notify-table tbody').empty();
		notifyData.forEach(notify => bindNotifyTable(notify));

		sortableTable();
		refreshMonitorTypeDropdowns();

		// === 6. LOAD QUERY BUILDER RULES ===
		$('#query-builder-root').empty();

		let hasLoadedRules = false;

		if (ruleData.rules) {
			if (typeof ruleData.rules === 'object' && ruleData.rules.rules && Array.isArray(ruleData.rules.rules)) {
				// New nested format
				loadRulesIntoBuilder(ruleData.rules);
				hasLoadedRules = true;
			} else if (Array.isArray(ruleData.rules) && ruleData.rules.length > 0) {
				// Old flat format
				const rootGroupId = createGroup();
				setOperator(rootGroupId, 'AND');
				updateOperatorSwitchState(rootGroupId);

				ruleData.rules.forEach(item => {
					const ruleId = addRule(rootGroupId);

					const $type = $(`#${ruleId}-type`);
					const $monitor = $(`#${ruleId}-monitor`);
					const $operation = $(`#${ruleId}-operation`);
					const $value = $(`#${ruleId}-value`);

					if ($type.length) $type.val(item.moniterType || item.type || 'headers').trigger('change');
					if ($monitor.length) $monitor.val(item.moniterValue || item.monitor || '');
					if ($operation.length) $operation.val(item.operation || '=').trigger('change');
					if ($value.length) $value.val(item.column || item.value || '');
				});
				feather.replace();
				hasLoadedRules = true;
			}
		}

		// === Only create empty state if NO rules were loaded ===
		if (!hasLoadedRules) {
			const rootGroupId = createGroup();
			setOperator(rootGroupId, 'AND');
			updateOperatorSwitchState(rootGroupId);
			addRule(rootGroupId);
		}

		// === 7. Final setup ===
		isEditingRule = false;
		$('#moniter-rule-modal-slide-in').data('edit-id', rowIndex);

		// Show modal only AFTER everything is ready
		$('#moniter-rule-modal-slide-in').modal('show');

	} catch (err) {
		console.error('Error in edit handler:', err);
		isEditingRule = false;
	}
});

function loadRulesIntoBuilder(rulesData) {
	function buildGroup(rulesArray, parentId = null) {
		const groupId = createGroup(parentId, parentId !== null);

		// Set operator (AND/OR)
		const operator = rulesArray.condition || 'AND';
		setOperator(groupId, operator);
		updateOperatorSwitchState(groupId);

		rulesArray.rules.forEach(item => {
			if (item.rules && item.condition) {
				// It's a nested group
				buildGroup(item, groupId);
			} else {
				// It's a single rule
				addRule(groupId);
				const lastRule = $('#' + groupId + '-rules .rule-container').last();
				const ruleId = lastRule.attr('id');

				$('#' + ruleId + '-type').val(item.type || 'headers').trigger('change');
				$('#' + ruleId + '-monitor').val(item.monitor || '');
				$('#' + ruleId + '-operation').val(item.operation || '=').trigger('change');
				$('#' + ruleId + '-value').val(item.value || '');
			}
		});
	}

	// Start building from root
	if (rulesData.condition && rulesData.rules) {
		buildGroup(rulesData);
	} else if (Array.isArray(rulesData) && rulesData.length > 0) {
		// Fallback: flat array of rules (old format?)
		const rootGroupId = createGroup();
		rulesData.forEach(item => {
			addRule(rootGroupId);
			const lastRule = $('#' + rootGroupId + '-rules .rule-container').last();
			const ruleId = lastRule.attr('id');

			$('#' + ruleId + '-type').val(item.moniterType || 'headers').trigger('change');
			$('#' + ruleId + '-monitor').val(item.moniterValue || '');
			$('#' + ruleId + '-operation').val(item.operation || '=').trigger('change');
			$('#' + ruleId + '-value').val(item.column || '');
		});
	} else {
		const rootGroupId = createGroup();
		addRule(rootGroupId);
	}

	feather.replace();
}

$('#moniter-rule-body').on('click', '.delete-moniter-rule-row', function () {
	const rowIndex = $(this).closest('tr').index();
	moniterRules.splice(rowIndex, 1);
	bindMoniterTable(moniterRules);
});

if ($('#form-moniter-rule-create').length) {
	formValidator = $('#form-moniter-rule-create').validate({
		rules: {
			'rule-name': {
				required: true
			},
			'select-security-level': {
				required: true
			},
			'duration-value': {
				number: true,
			},
			'per-item-times': {
				number: true,
			},
			'select-company-type': {
				required: true
			},
			'select-project-type': {
				required: true
			},
			'select-item-type': {
				required: true
			}
		},
		messages: {
			'rule-name': {
				required: 'Please enter the rule Name!'
			},
			'select-security-level': {
				required: 'Please select security level'
			},
			'duration-value': {
				required: 'Please enter duration value'
			},
			'per-item-times': {
				required: 'Please enter per item times value'
			},
			'select-company-type': {
				required: 'Please select Company!'
			},
			'select-project-type': {
				required: 'Please select Project!'
			},
			'select-item-type': {
				required: 'Please select Item!'
			}
		},
		submitHandler: function (form) {
			handleFormSubmitAlertConditions();
		},
		errorPlacement: function (error, element) {
			clearErrorForElement(element);
			showError(element, error.text());
		}
	});
}

$('#rule-body').on('click', '.delete-logical-rule-row', function () {
	$(this).closest('tr').remove();
});

function generateSimpleSQL(queryObject) {
	if (!queryObject.rules || queryObject.rules.length === 0) {
		return "-- No conditions specified";
	}

	const condition = buildSimpleCondition(queryObject);
	return condition;
}

function buildSimpleCondition(queryObject, isNested = false) {
	const parts = [];

	queryObject.rules.forEach(rule => {
		if (rule.rules) {
			// This is a nested group
			const nestedCondition = buildSimpleCondition(rule, true);
			if (nestedCondition) {
				parts.push(`(${nestedCondition})`);
			}
		} else {
			// This is a rule
			const field = rule.monitor;
			const operator = rule.operation;
			const value = rule.value;
			// Use default type if not specified
			const fieldType = fieldTypes[rule.type] || 'string';

			if (field && operator && value) {
				let conditionPart = `${field} `;

				switch (operator) {
					case '=':
					case '>':
					case '>=':
					case '<=':
					case '<':
						conditionPart += `${operator} ${formatSimpleValue(value, fieldType)}`;
						break;
					case '<>':
						conditionPart += `!= ${formatSimpleValue(value, fieldType)}`;
						break;
					case 'Contains':
						conditionPart += `LIKE '%${escapeSQL(value)}%'`;
						break;
					default:
						conditionPart += `${operator} ${formatSimpleValue(value, fieldType)}`;
				}

				parts.push(conditionPart);
			}
		}
	});

	if (parts.length === 0) return '';
	if (parts.length === 1) return parts[0];

	return parts.join(` ${queryObject.condition.toUpperCase()} `);
}

function formatSimpleValue(value, fieldType) {
	if (fieldType === 'number') {
		return isNaN(value) ? `'${escapeSQL(value)}'` : value;
	} else {
		return `'${escapeSQL(value)}'`;
	}
}

function escapeSQL(value) {
	return value.replace(/'/g, "''");
}

function handleFormSubmitAlertConditions() {
	if (validateAllFields()) {
		const $form = $('#form-moniter-rule-create');
		const $overlay = $('.overlay');
		$form.find('button[type="submit"]').prop('disabled', true);
		$overlay.add('body').removeClass('loaded').css('display', 'block');

		const ruleId = $('#moniter-rule-modal-slide-in').data('edit-id');
		const isEdit = ruleId !== undefined;
		const notifyMethodTypes = [...new Set(notifyData.map(item => item.type))].join(', ');

		const queryRules = getQueryObject();

		const groupByValue = $('#group-by').val();

		const threshold = {
			durationValue: Number($('#duration-value').val()) || null,
			durationUnit: $('#duration-unit').val() || 'minutes',
			groupBy: groupByValue
		};

		if (groupByValue === 'per_item') {
			threshold.times = Number($('#per-item-times').val()) || 1;
		}

		const data = {
			name: $('#rule-name').val(),
			description: $('#rule-description').val(),
			securityLevel: $('#select-security-level').val(),
			companyId: $('#select-company-type').val(),
			projectId: $('#select-project-type').val(),
			itemType: $('#select-item-type').val(),
			notifyMethod: notifyMethodTypes,
			threshold: threshold,
			rules: queryRules,
			notify: [],
			variables: collectVariablesData(),
			createdAt: isEdit ? moment(moniterRules[ruleId].createdAt).format("YYYY-MM-DD HH:mm:ss.SSS") : moment().format("YYYY-MM-DD HH:mm:ss.SSS"),
			updatedAt: moment().format("YYYY-MM-DD HH:mm:ss.SSS"),
		};

		data.notify = notifyData;

		if (isEdit) {
			moniterRules[ruleId] = data;
		} else {
			moniterRules.push(data);
		}

		bindMoniterTable(moniterRules);

		notifyData = [];
		$form[0].reset();
		clearErrors();
		$('#rule-table tbody').empty();
		$('.overlay, body').addClass('loaded');
		$('.overlay').css({ 'display': 'none' });
		$('#form-moniter-rule-create').find('button[type="submit"]').prop('disabled', false);
		$('#moniter-rule-modal-slide-in').modal('hide').removeData('edit-id');

		Swal.fire({
			title: 'Success!',
			text: ruleId !== null ? 'Moniter rule updated successfully!' : 'Moniter rule created successfully!',
			icon: 'success',
			customClass: {
				confirmButton: 'btn btn-primary'
			},
			buttonsStyling: false,
			timer: 1200
		});
	}
}

function validateAndGenerate() {
	if (validateAllFields()) {
		const query = getQueryObject();
		$('#query-output').text(JSON.stringify(query, null, 2));

		// Generate SQL statement in the simple format
		const sql = generateSimpleSQL(query);
		$('#sql-output').text(sql);
		$('#alert-moniter-notify-query--modal-slide-in').modal('show');

	}
}

$('#variables-btn-add-row').on('click', function () {
	addVariablesRow();
});

// Delete row
$(document).on('click', '.variables-btn-del', function () {
	const $row = $(this).closest('tr');
	const $table = $row.closest('table');

	if ($table.find('tbody tr').length <= 1) {
		return; // don't delete last row
	}

	notifyActionCounters.variables--;
	$row.remove();
});

function addVariablesRow() {
	const $table = $('#variables-table');
	const $template = $table.find('tbody tr:first').clone();

	const counter = notifyActionCounters.variables++;

	// Update IDs, names, labels
	$template.find('*').addBack().each(function () {
		const $el = $(this);
		if ($el.attr('id')) {
			$el.attr('id', $el.attr('id').replace(/-\d+$/, '-' + counter));
		}
		if ($el.attr('name')) {
			$el.attr('name', $el.attr('name').replace(/\[\d*\]/g, '[' + counter + ']'));
		}
		if ($el.is('label') && $el.attr('for')) {
			$el.attr('for', $el.attr('for').replace(/-\d+$/, '-' + counter));
		}
	});

	// Clear values
	$template.find('input[type="text"]').val('');
	$template.find('input[type="checkbox"]').prop('checked', true);

	// Re-bind delete button
	$template.find('.variables-btn-del').off('click').on('click', function () {
		const $rowToDel = $(this).closest('tr');
		const $tbl = $rowToDel.closest('table');
		if ($tbl.find('tbody tr').length <= 1) return;
		notifyActionCounters.variables--;
		$rowToDel.remove();
	});

	$table.find('tbody').append($template);
}

function collectVariablesData() {
	const variables = [];
	$('#variables-table tbody tr').each(function () {
		const $row = $(this);
		variables.push({
			enabled: $row.find('input[id*="status"]:not([id*="mask"])').is(':checked'),
			key: $row.find('input[id*="key"]').val().trim(),
			value: $row.find('input[id*="value"]').val().trim(),
			mask: $row.find('input[id*="mask-status"]').is(':checked'),
			description: $row.find('input[id*="description"]').val().trim()
		});
	});
	return variables;
}

function resetVariablesTable() {
	const $tbody = $('#variables-table tbody');
	$tbody.find('tr:gt(0)').remove(); // remove all except first

	// Reset first row
	const $firstRow = $tbody.find('tr:first');
	$firstRow.find('input[type="text"]').val('');
	$firstRow.find('input[type="checkbox"]').prop('checked', true);

	// Reset IDs/names to 0
	$firstRow.find('[id],[for]').each(function () {
		const $el = $(this);
		const attr = $el.is('label') ? 'for' : 'id';
		const val = $el.attr(attr);
		if (val) $el.attr(attr, val.replace(/-\d+$/, '-0'));
	});
	$firstRow.find('[name]').each(function () {
		const $el = $(this);
		const name = $el.attr('name');
		if (name) $el.attr('name', name.replace(/\[\d*\]/g, '[0]'));
	});

	notifyActionCounters.variables = 1;
}

function loadVariablesIntoTable(variablesArray) {
	resetVariablesTable();

	if (!Array.isArray(variablesArray) || variablesArray.length === 0) {
		return;
	}

	// First row
	populateVariablesRow($('#variables-table tbody tr:first'), variablesArray[0], 0);

	// Add more rows if needed
	variablesArray.slice(1).forEach((item, idx) => {
		addVariablesRow();
		const $newRow = $('#variables-table tbody tr').last();
		populateVariablesRow($newRow, item, idx + 1);
	});
}

function populateVariablesRow($row, data, index) {
	$row.find('input[id*="status"]:not([id*="mask"])').prop('checked', data.enabled !== false);
	$row.find('input[id*="key"]').val(data.key || '');
	$row.find('input[id*="value"]').val(data.value || '');
	$row.find('input[id*="mask-status"]').prop('checked', data.mask !== false);
	$row.find('input[id*="description"]').val(data.description || '');

	// Update IDs to match index
	$row.find('[id],[for]').each(function () {
		const $el = $(this);
		const attr = $el.is('label') ? 'for' : 'id';
		const val = $el.attr(attr);
		if (val) $el.attr(attr, val.replace(/-\d+$/, '-' + index));
	});
}


$('#notify-headers-btn-add-row').click(function () {
	currentEditActionIndex = null;

	// Destroy Select2 to avoid conflicts
	$('#notify-select-webhook-method, #select-webhook-body-type').each(function () {
		if ($(this).data('select2')) $(this).select2('destroy');
	});

	notifyresetActionModal();
	notifysetSelectDefaults();
	notifyinitializeSelect2();
	notifyinitializeSortables();
	formValidator = null;

	$('#notify-modal-slide-in').modal('show');
});

function notifysetSelectDefaults() {
	$('#notify-select-webhook-method').val('POST').trigger('change');
	$('#notify-select-webhook-body-type').val('JSON').trigger('change');
}

function notifyresetActionModal() {
	$('#form-notify-action-create')[0].reset();

	// Reset counters properly
	notifyActionCounters = {
		webhookHeaders: 1
	};

	$('#customRadio1webhook').prop('checked', true).trigger('change');

	// Remove extra rows but keep first row
	$('#notify-webhook-headers-table tbody tr:gt(0)').remove();

	notifyresetAllFirstRows();
	$('#notify-webhook-method-custom-row').hide();
	$('#notify-webhook-method-custom-value').val('').prop('required', false);
	clearAllError();
}

function notifyresetAllFirstRows() {
	const tables = [
		{ id: 'notify-webhook-headers-table', prefix: 'webhook-headers' }
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
}

function notifyinitializeSelect2() {
	['#notify-notify-select-webhook-method', '#notify-select-webhook-body-type'].forEach(sel => {
		const $el = $(sel);
		if ($el.data('select2')) $el.select2('destroy');
		$el.select2({
			minimumResultsForSearch: Infinity,
			width: '100%',
			dropdownParent: $('#notify-modal-slide-in'),
			allowClear: false
		});
	});
}

function notifyinitializeSortables() {
	['#notify-webhook-headers-table'].forEach(id => {
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

function notifytoggleActionSections() {
	const type = $('input[name="customRadioalert"]:checked').val();
	$('#notify-webhook-section').toggle(type === 'Webhook');
	$('#notify-email-section').toggle(type === 'Email');
}

$(document).on('change', 'input[name="customRadioalert"]', function () {
	$('.custom-control.custom-radio').removeClass('active');
	$(this).closest('.custom-control.custom-radio').addClass('active');
	notifytoggleActionSections();
	clearAllError();
});

notifytoggleActionSections();

$('#notify-select-webhook-method').on('change', function () {
	const isCustom = $(this).val() === 'Customize';
	$('#notify-webhook-method-custom-row').toggle(isCustom);
	$('#notify-webhook-method-custom-value').prop('required', isCustom);
});


// DYNAMIC ROW ADDER (FIXED VERSION)
function notifyaddDynamicRow(tableId) {
	const $table = $('#' + tableId);
	const $template = $table.find('tbody tr:first').clone();

	// Get and increment the correct counter
	let counter;
	let counterType;
	if (tableId.includes('notify-webhook-headers')) {
		counter = notifyActionCounters.webhookHeaders++;
		counterType = 'webhookHeaders';
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
		if (tableIdToDelete.includes('notify-webhook-headers')) {
			notifyActionCounters.webhookHeaders--;
		}

		$rowToDelete.remove();
	});

	$table.find('tbody').append($template);
}

// ADD ROW BUTTONS
$('body').on('click', '#notify-webhook-headers-btn-add-row', () => notifyaddDynamicRow('notify-webhook-headers-table'));

// DELETE ROWS (FIXED VERSION)
$(document).on('click', '.notify-webhook-headers-btn-del', function () {
	const $row = $(this).closest('tr');
	const $table = $row.closest('table');
	const tableId = $table.attr('id');

	// Don't allow deleting the last row in each table
	if ($table.find('tbody tr').length <= 1) {
		return;
	}

	// Decrement the correct counter before removing
	if (tableId.includes('notify-webhook-headers')) {
		notifyActionCounters.webhookHeaders--;
	}

	$row.remove();
});

function collectWebhookDataAlert() {
	const headers = [];

	$('#notify-webhook-headers-table tbody tr').each(function () {
		const $row = $(this);
		headers.push({
			enabled: $row.find('input[id*="status"]:not([id*="mask"])').is(':checked'),
			key: $row.find('input[name*="key"]').val().trim(),
			value: $row.find('input[name*="value"]').val().trim(),
			mask: $row.find('input[id*="mask-status"]').is(':checked'),
			description: $row.find('input[name*="description"]').val().trim()
		});
	});

	const method = $('#notify-select-webhook-method').val() === 'Customize'
		? $('#notify-webhook-method-custom-value').val().trim()
		: $('#notify-select-webhook-method').val();

	return {
		url: $('#notify-item-action-webhook-url').val().trim(),
		method,
		bodyType: $('#notify-select-webhook-body-type').val(),
		content: $('#notify-webhook-content').val(),
		headers
	};
}

function collectEmailDataAlert() {
	return {
		to: $('#notify-item-action-email-to').val().trim(),
		subject: $('#notify-item-action-email-subject').val().trim(),
		content: $('#notify-email-content').val()
	};
}

function notifyshowFieldError($field, msg) {
	$field.addClass('is-invalid').after(`<div class="invalid-feedback d-block">${msg}</div>`);
	if ($('.is-invalid').length === 1) $field[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function notifyvalidateActionForm() {
	clearAllError();
	let valid = true;

	if (!$('#notify-action-description').val().trim()) {
		notifyshowFieldError($('#notify-action-description'), 'Description is required');
		valid = false;
	}

	const type = $('input[name="customRadioalert"]:checked').val();
	if (type === 'Webhook') {
		if (!$('#notify-item-action-webhook-url').val().trim()) {
			notifyshowFieldError($('#notify-item-action-webhook-url'), 'Webhook URL is required');
			valid = false;
		}
		if ($('#notify-select-webhook-method').val() === 'Customize' && !$('#notify-webhook-method-custom-value').val().trim()) {
			notifyshowFieldError($('#notify-webhook-method-custom-value'), 'Custom method is required');
			valid = false;
		}
	} else {
		if (!$('#notify-item-action-email-to').val().trim()) {
			notifyshowFieldError($('#notify-item-action-email-to'), 'Email To is required');
			valid = false;
		}
		if (!$('#notify-item-action-email-subject').val().trim()) {
			notifyshowFieldError($('#notify-item-action-email-subject'), 'Subject is required');
			valid = false;
		}
	}
	return valid;
}

$(document).on('click', '#save-action', saveNotifyAction);

function saveNotifyAction() {
	if (!notifyvalidateActionForm()) return;

	const actionType = $('input[name="customRadioalert"]:checked').val();

	const actionData = {
		id: NotiFyCurrentEditActionIndex !== null
			? (notifyData[NotiFyCurrentEditActionIndex].id || Date.now())
			: Date.now(),
		description: $('#notify-action-description').val().trim(),
		type: actionType,
		actionType: actionType,
		status: true,
		createdAt: NotiFyCurrentEditActionIndex !== null
			? notifyData[NotiFyCurrentEditActionIndex].createdAt
			: moment().format("YYYY-MM-DD HH:mm:ss"),
		updatedAt: moment().format("YYYY-MM-DD HH:mm:ss")
	};

	if (actionType === 'Webhook') {
		actionData.webhook = collectWebhookDataAlert();
	} else if (actionType === 'Email') {
		actionData.email = collectEmailDataAlert();
	}

	// Add or update in notifyData array
	if (NotiFyCurrentEditActionIndex !== null) {
		notifyData[NotiFyCurrentEditActionIndex] = actionData;
	} else {
		notifyData.push(actionData);
	}

	// Rebind table and close modal
	bindNotifyTable();
	$('#notify-modal-slide-in').modal('hide');

	Swal.fire({
		title: 'Success!',
		text: NotiFyCurrentEditActionIndex !== null ? 'Notification action updated successfully!' : 'Notification action created successfully!',
		icon: 'success',
		customClass: {
			confirmButton: 'btn btn-primary'
		},
		buttonsStyling: false,
		timer: 1200
	});

	NotiFyCurrentEditActionIndex = null;
}

function bindNotifyTable(notifyItem = null, rowIndex = null) {
	const $tbody = $('#notify-table tbody');

	if (notifyItem && rowIndex !== null) {
		// Add or update a single row
		let $existingRow = $tbody.find(`tr[data-notify-id="${rowIndex}"]`);

		if ($existingRow.length) {
			// Update existing row
			$existingRow.html(generateNotifyTableRow(notifyItem, rowIndex));
		} else {
			// Add new row
			const rowHtml = `<tr data-notify-id="${rowIndex}">
				${generateNotifyTableRow(notifyItem, rowIndex)}
			</tr>`;
			$tbody.append(rowHtml);
		}
	} else {
		// Rebind entire table
		$tbody.empty();
		notifyData.forEach((item, index) => {
			const rowHtml = `<tr data-notify-id="${index}">
				${generateNotifyTableRow(item, index)}
			</tr>`;
			$tbody.append(rowHtml);
		});
	}

	feather.replace();
}

$(document).on('change', '.action-status-checkbox', function () {
	const index = $(this).attr('id').replace('action-status-', '');
	const isChecked = $(this).is(':checked');

	if (notifyData[index]) {
		notifyData[index].status = isChecked;
		notifyData[index].updatedAt = moment().format("YYYY-MM-DD HH:mm:ss");
	}

	console.log('Updated notifyData:', notifyData);
});

function generateNotifyTableRow(notifyItem, index) {
	const type = notifyItem.type || notifyItem.actionType || 'Unknown';
	const description = notifyItem.description || '';

	let detailHTML = '';

	if (type === "Email") {
		detailHTML = `
				<div class="text-left">
					<strong>Email To:</strong> ${escapeHtml(notifyItem.email?.to || 'N/A')}<br>
					<strong>Subject:</strong> ${escapeHtml(notifyItem.email?.subject || 'N/A')}<br>
					${notifyItem.email?.content ? `<strong>Content:</strong> ${escapeHtml(notifyItem.email.content.substring(0, 100))}${notifyItem.email.content.length > 100 ? '...' : ''}<br>` : ''}
				</div>
			`;
	} else if (type === "Webhook") {
		detailHTML = `
				<div class="text-left">
					<strong>URL:</strong> ${escapeHtml(notifyItem.webhook?.url || 'N/A')}<br>
					<strong>Method:</strong> ${notifyItem.webhook?.method || 'POST'}<br>
					<strong>Body Type:</strong> ${notifyItem.webhook?.bodyType || 'JSON'}<br>
					${notifyItem.webhook?.content ? `<strong>Content:</strong> ${escapeHtml(notifyItem.webhook.content.substring(0, 100))}${notifyItem.webhook.content.length > 100 ? '...' : ''}<br>` : ''}
					${notifyItem.webhook?.headers?.length > 0 ? `<strong>Headers:</strong> ${notifyItem.webhook.headers.length} added<br>` : ''}
				</div>
			`;
	}

	return `
		<td class="format-rules-icon text-center">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="16 18 22 12 16 6"></polyline>
				<polyline points="8 6 2 12 8 18"></polyline>
			</svg>
		</td>
		<td class="text-center">
			<div class="custom-control custom-checkbox">
				<input type="checkbox" class="custom-control-input action-status-checkbox" id="action-status-${index}" ${notifyItem.status !== false ? 'checked' : ''}>
				<label class="custom-control-label" for="action-status-${index}"></label>
			</div>
		</td>
		<td>${description}</td>
		<td style="font-size: 0.85rem; line-height: 1.4;">${detailHTML}</td>
		<td class="text-center">
			<a href="javascript:void(0);" type="button" class="btn btn-lg btn-del btn-edit-notify modal-button" data-notify-id="${index}" title="Edit">
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit font-medium-2">
						<path d="M17 3l4 4-11 11H3v-4L17 3z"></path>
					</svg>
			</a>

			<a href="javascript:void(0);" type="button" class="btn btn-lg btn-del modal-button btn-delete-notify" data-notify-id="${index}" title="Delete">
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2">
						<line x1="5" y1="12" x2="19" y2="12"></line>
					</svg>
			</a>
		</td>
	`;
}


function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

$(document).on('click', '.btn-delete-notify', function () {
	const notifyId = $(this).data('notify-id');

	Swal.fire({
		title: 'Are you sure?',
		text: 'You want to delete this notification action?',
		icon: 'warning',
		showCancelButton: true,
		confirmButtonText: 'Yes, delete it!',
		customClass: {
			confirmButton: 'btn btn-primary',
			cancelButton: 'btn btn-outline-danger ml-1'
		},
		buttonsStyling: false
	}).then(function (result) {
		if (result.value) {
			notifyData.splice(notifyId, 1);
			bindNotifyTable();
		}
	});
});

function loadNotifyIntoForm(notifyItem) {
	// Reset form first
	notifyresetActionModal();
	notifysetSelectDefaults();
	notifyinitializeSelect2();
	notifyinitializeSortables();

	// Set description
	$('#notify-action-description').val(notifyItem.description || '');

	// Set type (Webhook or Email)
	const type = notifyItem.type || notifyItem.actionType;
	if (type === 'Webhook') {
		$('#customRadio1webhook').prop('checked', true).trigger('change');
	} else {
		$('#customRadio2email').prop('checked', true).trigger('change');
	}

	// Load webhook data
	if (notifyItem.webhook) {
		$('#notify-item-action-webhook-url').val(notifyItem.webhook.url || '');
		$('#notify-select-webhook-method').val(notifyItem.webhook.method || 'POST').trigger('change');
		$('#notify-select-webhook-body-type').val(notifyItem.webhook.bodyType || 'JSON').trigger('change');
		$('#notify-webhook-content').val(notifyItem.webhook.content || '');

		// Load headers
		loadNotifyTableData(notifyItem.webhook.headers, 'notify-webhook-headers-table');
	}

	// Load email data
	if (notifyItem.email) {
		$('#notify-item-action-email-to').val(notifyItem.email.to || '');
		$('#notify-item-action-email-subject').val(notifyItem.email.subject || '');
		$('#notify-email-content').val(notifyItem.email.content || '');
	}
}

$(document).on('click', '.btn-edit-notify', function () {
	const notifyId = $(this).data('notify-id');
	NotiFyCurrentEditActionIndex = notifyId;
	const notifyItem = notifyData[notifyId];

	if (!notifyItem) return;

	loadNotifyIntoForm(notifyItem);
	$('#notify-modal-slide-in').modal('show');
});

function loadNotifyTableData(dataArray, tableId) {
	const $table = $('#' + tableId);
	const $tbody = $table.find('tbody');

	if (!Array.isArray(dataArray) || dataArray.length === 0) {
		return;
	}

	// Clear extra rows, keep first
	$tbody.find('tr:gt(0)').remove();

	// Update first row
	const firstRow = dataArray[0];
	const $firstRow = $tbody.find('tr:first');
	populateNotifyRow($firstRow, firstRow, 0, tableId);

	// Add remaining rows
	dataArray.slice(1).forEach((data, index) => {
		const rowIndex = index + 1;
		notifyaddDynamicRow(tableId);
		const $newRow = $tbody.find('tr:last');
		populateNotifyRow($newRow, data, rowIndex, tableId);
	});
}

function populateNotifyRow($row, data, rowIndex, tableId) {
	// Set enabled status
	const statusCheckbox = $row.find('input[id*="status"]:not([id*="mask"])');
	statusCheckbox.prop('checked', data.enabled !== false);

	// Set key
	$row.find('input[name*="key"]').val(data.key || '');

	// Set value
	$row.find('input[name*="value"]').val(data.value || '');

	// Set mask
	const maskCheckbox = $row.find('input[id*="mask-status"]');
	maskCheckbox.prop('checked', data.mask !== false);

	// Set description
	$row.find('input[name*="description"]').val(data.description || '');
}

$(document).on('input change', '.form-control', function () {
	$(this).removeClass('is-invalid').siblings('.invalid-feedback').remove();
});


function clearAllError() {
	$('.form-control').removeClass('is-invalid');
	$('.invalid-feedback').remove();
}


$('#notify-modal-slide-in').on('hidden.bs.modal', function () {
	NotiFyCurrentEditActionIndex = null;
	notifyresetActionModal();
});













































function getAllowedMonitorPrefixes() {
	const itemType = $('#select-item-type').val(); // all | specific
	const groupBy = $('#group-by').val(); // per_item | average

	// Specific Item exclude item_ and average_
	if (itemType !== 'all') {
		return {
			exclude: ['item_', 'average_']
		};
	}

	// All Items
	if (groupBy === 'per_item') {
		return {
			include: ['item_']
		};
	}

	if (groupBy === 'average') {
		return {
			include: ['average_']
		};
	}

	return null;
}

function buildFilteredMonitorOptions() {
	const filterRule = getAllowedMonitorPrefixes();

	// No filter → full list
	if (!filterRule) {
		return flattenedOptions;
	}

	const filtered = [];

	moniterTypeOptions.forEach(group => {
		const children = group.children.filter(child => {

			// INCLUDE logic
			if (filterRule.include) {
				return filterRule.include.some(prefix =>
					child.id.startsWith(prefix)
				);
			}

			// EXCLUDE logic
			if (filterRule.exclude) {
				return !filterRule.exclude.some(prefix =>
					child.id.startsWith(prefix)
				);
			}

			return true;
		});

		if (children.length) {
			filtered.push({ text: group.text, disabled: true });
			children.forEach(child => filtered.push(child));
		}
	});

	return filtered;
}

function refreshMonitorTypeDropdowns() {
	const newOptions = buildFilteredMonitorOptions();

	$('.rule-container').each(function () {
		const ruleId = $(this).attr('id');
		const $type = $('#' + ruleId + '-type');
		const currentVal = $type.val();

		$type.empty().select2('destroy');

		$type.select2({
			data: newOptions,
			placeholder: '-- Select Monitor Type --',
			dropdownParent: $(document.body),
			width: '100%',
			templateResult: function (data) {
				if (data.disabled) {
					return $('<strong>').text(data.text);
				}
				return $('<span>').text(data.text).css('padding-left', '20px');
			}
		});

		// Restore value if still valid
		if (currentVal && newOptions.some(o => o.id === currentVal)) {
			$type.val(currentVal).trigger('change');
		} else {
			const firstSelectable = newOptions.find(o => o.id);
			if (firstSelectable) {
				$type.val(firstSelectable.id).trigger('change');
			}
		}
	});
}

// Create Group Function
function createGroup(parentId = null, isNested = false) {
	const groupId = 'group-' + groupCounter++;
	const isRootGroup = !parentId;

	const groupHtml = `
                <div class="query-builder-group ${isNested ? 'nested-group' : ''}" id="${groupId}" data-parent="${parentId || ''}">
                    <div class="group-header">
                        ${isRootGroup ?
			'<i data-feather="move" class="feather drag-handle root-group"></i>' :
			'<i data-feather="move" class="feather drag-handle"></i>'
		}
                        <div class="operator-switch" id="${groupId}-switch">
                            <div class="switch-slider"></div>
                            <div class="switch-option active" onclick="onOperatorClick('${groupId}', 'AND')">AND</div>
                            <div class="switch-option" onclick="onOperatorClick('${groupId}', 'OR')">OR</div>
                        </div>
                        <input type="hidden" id="${groupId}-operator" value="AND">
                        <div class="group-actions">
                            <button type="button" class="btn btn-sm btn-add-rule" onclick="addRule('${groupId}')">Add Rule</button>
                            <button type="button" class="btn btn-sm btn-add-group" onclick="addGroup('${groupId}')">Add Group</button>
                            ${parentId ? `<button type="button" class="btn btn-sm btn-delete-group" onclick="deleteGroup('${groupId}')">Delete</button>` : ''}
                        </div>
                    </div>
                    <div class="group-rules" id="${groupId}-rules"></div>
                </div>
            `;

	if (parentId) {
		$('#' + parentId + '-rules').append(groupHtml);
	} else {
		$('#query-builder-root').html(groupHtml);
	}

	initSortable(groupId);
	feather.replace();
	updateOperatorSwitchState(groupId);
	return groupId;
}

function onOperatorClick(groupId, operator) {
	const $switch = $('#' + groupId + '-switch');
	if ($switch.hasClass('disabled')) return;
	setOperator(groupId, operator);
}

function setOperator(groupId, operator) {
	const $operatorInput = $('#' + groupId + '-operator');
	const $andOption = $('#' + groupId + '-switch .switch-option:first');
	const $orOption = $('#' + groupId + '-switch .switch-option:last');
	const $slider = $('#' + groupId + '-switch .switch-slider');

	// Update hidden input
	$operatorInput.val(operator);

	// Update switch visual state
	if (operator === 'AND') {
		$andOption.addClass('active');
		$orOption.removeClass('active');
		$slider.removeClass('or');
	} else {
		$andOption.removeClass('active');
		$orOption.addClass('active');
		$slider.addClass('or');
	}
}

function initSortable(groupId) {
	const $rulesContainer = $('#' + groupId + '-rules');

	if (!$rulesContainer.length) return;

	// Ensure the container has minimum height for drop target detection
	$rulesContainer.css({
		'min-height': '60px',  // Critical: makes empty groups droppable
		'position': 'relative'
	});

	$rulesContainer.sortable({
		items: '> .rule-container, > .query-builder-group',
		handle: '.drag-handle',
		cursor: 'move',
		axis: 'y',
		tolerance: 'pointer',
		connectWith: '.group-rules',  // Allows dragging between groups
		placeholder: 'sortable-placeholder',
		forcePlaceholderSize: true,
		opacity: 0.8,
		delay: 150,
		distance: 10,

		start: function (e, ui) {
			$('.query-builder-group').addClass('drag-over');
			$('.group-rules').each(function () {
				if ($(this).children().length === 0) {
					$(this).css('min-height', '100px');
				}
			});

			ui.placeholder.height(ui.item.height() + 20);
		},

		stop: function (e, ui) {
			$('.query-builder-group').removeClass('drag-over');
			$('.group-rules').css('min-height', '60px');
		},

		over: function (e, ui) {
			$(this).addClass('drag-over-highlight');
		},

		out: function (e, ui) {
			$(this).removeClass('drag-over-highlight');
		},

		receive: function (e, ui) {
			const $toGroup = $(this).closest('.query-builder-group');
			if ($toGroup.length) {
				updateOperatorSwitchState($toGroup.attr('id'));
			}

			const $fromGroup = ui.sender ? ui.sender.closest('.query-builder-group') : null;
			if ($fromGroup && $fromGroup.length) {
				updateOperatorSwitchState($fromGroup.attr('id'));
			}
		},

		update: function (e, ui) {
			const $currentGroup = $(this).closest('.query-builder-group');
			if ($currentGroup.length) {
				updateOperatorSwitchState($currentGroup.attr('id'));
			}
		}
	});
}

function updateOperatorSwitchState(groupId) {
	const $group = $('#' + groupId);
	const $switch = $('#' + groupId + '-switch');
	const childCount = $group.find('> .group-rules > .rule-container, > .group-rules > .query-builder-group').length;

	if (childCount >= 2) {
		$switch.removeClass('disabled');
	} else {
		$switch.addClass('disabled');
	}
}

// Add Rule Function
function addRule(groupId) {
	const ruleId = 'rule-' + ruleCounter++;

	const ruleHtml = `
		<div class="rule-container" id="${ruleId}">
			<table class="rule-table">
				<tbody>
					<tr>
						<td style="width: 5%;">
							<i data-feather="move" class="feather drag-handle"></i>
						</td>
						<td style="width: 22%;">
							<select class="select2 form-control border-0" id="${ruleId}-type" onchange="validateField(this, 'Monitor Type')"></select>
							<div class="error-message" id="${ruleId}-type-error">Monitor Type is required</div>
						</td>
						<td style="width: 25%;">
							<input type="text" class="form-control border-0" id="${ruleId}-monitor" placeholder="Monitor Value" oninput="validateField(this, 'Monitor Value')">
							<div class="error-message" id="${ruleId}-monitor-error">Monitor value is required</div>
						</td>
						<td style="width: 12%;">
							<select class="select2 form-control border-0" id="${ruleId}-operation" onchange="validateField(this, 'Operator')"></select>
							<div class="error-message" id="${ruleId}-operation-error">Operator is required</div>
						</td>
						<td style="width: 30%;">
							<input type="text" class="form-control border-0" id="${ruleId}-value" placeholder="Column Value" oninput="validateField(this, 'Column Value')">
							<div class="error-message" id="${ruleId}-value-error">Column value is required</div>
						</td>
						<td style="width: 6%;">
							<button class="btn btn-del modal-button"
								onclick="deleteRule('${ruleId}')">
								<i data-feather="x" class="feather"></i>
							</button>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	`;

	$('#' + groupId + '-rules').append(ruleHtml);

	const $type = $('#' + ruleId + '-type');
	const $op = $('#' + ruleId + '-operation');
	const $monitor = $('#' + ruleId + '-monitor');
	const $value = $('#' + ruleId + '-value');

	$type.select2({
		data: flattenedOptions,
		placeholder: '-- Select Monitor Type --',
		dropdownParent: $(document.body),
		width: '100%',
		templateResult: function (data) {
			if (data.disabled) {
				return $('<strong>').text(data.text);
			}
			return $('<span>').text(data.text).css('padding-left', '20px');
		}
	});

	$op.select2({
		data: compairisonOptions,
		placeholder: '-- Select Operation --',
		minimumResultsForSearch: -1,
		dropdownParent: $(document.body),
		width: '100%'
	});

	$type.on('change', function () {
		const selectedType = $(this).val();
		const defaults = monitorRuleDefaults[selectedType];

		if (!defaults) {
			$monitor.val('');
			$value.val('');
			return;
		}

		// Default Monitor Value
		$monitor.val(defaults.monitor || '');

		// Default Comparison
		if (defaults.operation) {
			$op.val(defaults.operation).trigger('change');
		}

		// Default Column Value
		$value.val(defaults.value ?? '');
	});

	const filteredOptions = buildFilteredMonitorOptions();
	$type.empty().select2('destroy');

	$type.select2({
		data: filteredOptions,
		placeholder: '-- Select Monitor Type --',
		dropdownParent: $(document.body),
		width: '100%',
		templateResult: function (data) {
			if (data.disabled) {
				return $('<strong>').text(data.text);
			}
			return $('<span>').text(data.text).css('padding-left', '20px');
		}
	});

	const firstSelectable = filteredOptions.find(o => o.id);
	if (firstSelectable) {
		$type.val(firstSelectable.id).trigger('change');
	}

	$(`#${ruleId}-type`).on('change', function () {
		validateField(this, 'Monitor Type');
	});

	$(`#${ruleId}-operation`).on('change', function () {
		validateField(this, 'Operator');
	});

	$(`#${ruleId}-monitor`).on('input', function () {
		validateField(this, 'Monitor Value');
	});

	$(`#${ruleId}-value`).on('input', function () {
		const $value = $(this);
		const ruleId = $value.closest('.rule-container').attr('id');
		const operation = $(`#${ruleId}-operation`).val();

		if ($value.val() && (operation === 'in' || operation === 'not in')) {
			validateField(this, 'Column Value');
		}
	});

	feather.replace();

	// Update group badge state
	updateOperatorSwitchState(groupId);
}

function validateField(field, fieldName) {
	const $field = $(field);
	const value = $field.val() && $field.val().trim();
	const ruleId = $field.closest('.rule-container').attr('id');
	const errorId = `${ruleId}-${field.id.split('-').pop()}-error`;
	const $error = $(`#${errorId}`);

	// Clear previous validation state
	$field.removeClass('error valid');
	$error.hide();

	const operation = $(`#${ruleId}-operation`).val();
	const isColumnValue = field.id.includes('-value');

	// Check if field is required and empty
	if (!value) {
		$field.addClass('error');
		$error.text(`${fieldName} is required`).show();
		return false;
	}

	if (isColumnValue) {

		// Existing IN / NOT IN validation (KEEP AS IS)
		if (operation === 'In' || operation === 'Not In') {
			const validationResult = validateInOperatorSyntax(value, operation);

			if (!validationResult.isValid) {
				$field.addClass('error');
				$error.text(validationResult.errors.join(' | ')).show();
				return false;
			}
		}

		// Hyperformula validation (ONLY if formula)
		if (value.startsWith('=')) {
			const hfValidation = validateHyperFormulaSyntax(value);

			if (!hfValidation.isValid) {
				$field.addClass('error');
				$error.text(hfValidation.errors.join(' | ')).show();
				return false;
			}
		}
	}


	// If validation passed
	$field.addClass('valid');
	return true;
}

function validateAllFields() {
	let isValid = true;
	const errors = [];

	$('#validation-summary').hide();
	$('#validation-errors').empty();

	// Validate all rules
	$('.rule-container').each(function () {
		const ruleId = $(this).attr('id');

		// Validate monitor type
		const $type = $(`#${ruleId}-type`);
		if (!validateField($type[0], 'Monitor Type')) {
			isValid = false;
		}

		// Validate monitor/column name
		const $monitor = $(`#${ruleId}-monitor`);
		if (!validateField($monitor[0], 'Monitor Value')) {
			isValid = false;
		}

		// Validate operator
		const $operation = $(`#${ruleId}-operation`);
		if (!validateField($operation[0], 'Operator')) {
			isValid = false;
		}

		// Validate value
		const $value = $(`#${ruleId}-value`);
		if (!validateField($value[0], 'Column Value')) {
			isValid = false;
		}
	});

	// Check if there are any rules at all
	if ($('.rule-container').length === 0) {
		isValid = false;
		errors.push('Add at least one rule to generate SQL');
	}

	if (!isValid && errors.length > 0) {
		$('#validation-summary').show();
		errors.forEach(error => {
			$('#validation-errors').append(`<li>${error}</li>`);
		});
	}

	return isValid;
}

function validateInOperatorSyntax(value, operation) {
	const trimmed = value.trim();
	const errors = [];

	// Exception Type 1: Empty value
	if (!trimmed) {
		return {
			isValid: false,
			errors: ['Value is empty']
		};
	}

	// Exception Type 2: For 'in' or 'not in' - must have parentheses
	if (operation === 'In' || operation === 'Not In') {
		// Exception 2.1: Missing opening parenthesis
		if (!trimmed.startsWith('(')) {
			errors.push('Missing opening parenthesis "(" at the beginning');
		}

		// Exception 2.2: Missing closing parenthesis
		if (!trimmed.endsWith(')')) {
			errors.push('Missing closing parenthesis ")" at the end');
		}

		// Exception 2.3: Incomplete/unmatched parentheses
		const openCount = (trimmed.match(/\(/g) || []).length;
		const closeCount = (trimmed.match(/\)/g) || []).length;

		if (openCount !== closeCount) {
			errors.push(`Unmatched parentheses: ${openCount} opening, ${closeCount} closing`);
		}

		// If parentheses errors found, return early
		if (errors.length > 0) {
			return { isValid: false, errors };
		}

		// Extract content between outer parentheses
		const content = trimmed.slice(1, -1).trim();

		// Exception Type 3: Empty parentheses
		if (!content) {
			errors.push('Parentheses are empty - must contain at least one value');
		}

		// Exception Type 4: Validate individual items
		if (content) {
			const items = content.split(',');

			items.forEach((item, index) => {
				const itemTrimmed = item.trim();
				const itemNumber = index + 1;

				// Exception 4.1: Empty item (e.g., "value1",,  "value2")
				if (!itemTrimmed) {
					errors.push(`Item ${itemNumber}: Empty value between commas`);
					return;
				}

				// Exception 4.2: Missing opening quote
				if (!itemTrimmed.startsWith('"')) {
					errors.push(`Item ${itemNumber} "${itemTrimmed}": Missing opening double quote`);
				}

				// Exception 4.3: Missing closing quote
				if (!itemTrimmed.endsWith('"')) {
					errors.push(`Item ${itemNumber} "${itemTrimmed}": Missing closing double quote`);
				}

				// Exception 4.4: Single quotes used instead of double quotes
				if (itemTrimmed.startsWith("'") || itemTrimmed.endsWith("'")) {
					errors.push(`Item ${itemNumber}: Use double quotes (") not single quotes (')`);
				}

				// Exception 4.5: Unescaped quotes inside value
				if (itemTrimmed.startsWith('"') && itemTrimmed.endsWith('"')) {
					const innerContent = itemTrimmed.slice(1, -1);
					const unescapedQuotes = innerContent.split('').filter(char => char === '"');

					if (unescapedQuotes.length > 0) {
						errors.push(`Item ${itemNumber}: Contains unescaped double quotes inside value`);
					}
				}

				// Exception 4.6: Empty quoted value
				if (itemTrimmed === '""') {
					errors.push(`Item ${itemNumber}: Empty quoted string - must contain a value`);
				}
			});

			// Exception Type 5: Check for extra brackets or invalid characters
			const hasInvalidBrackets = /[\[\{\}]/.test(content);
			if (hasInvalidBrackets) {
				errors.push('Invalid brackets found: only use parentheses () not [] or {}');
			}
		}
	}

	return {
		isValid: errors.length === 0,
		errors: errors
	};
}

function validateHyperFormulaSyntax(formula) {
	try {
		if (!formula.trim().startsWith('=')) {
			return { isValid: false, errors: ['Formula must start with ='] };
		}

		let hfInstance = HyperFormula.buildFromArray(
			[[formula]],
			{ licenseKey: 'gpl-v3' }
		);

		let result = hfInstance.getCellValue({ sheet: 0, row: 0, col: 0 });
		console.log(result, "result");

		// Check if result is an error object (any error type: ERROR, NAME, DIV0, etc.)
		if (typeof result === 'object' && result !== null && result.type) {
			const hasPlaceholder = /@In\{|@Out\{/.test(formula);
			const errorMentionsPlaceholder = result.message.includes('@');

			// Ignore only if formula has @In{} or @Out{} AND error mentions @
			if (hasPlaceholder && errorMentionsPlaceholder) {
				return { isValid: true, errors: [], result: result, isDynamic: true };
			}

			// All other errors should be reported
			return { isValid: false, errors: [result.message] };
		}

		return { isValid: true, errors: [], result: result };
	} catch (err) {
		return { isValid: false, errors: [err.message] };
	}
}

// Add Nested Group
function addGroup(parentGroupId) {
	// New groups start with AND by default, no inheritance
	createGroup(parentGroupId, true);

	// Update parent group badge state
	updateOperatorSwitchState(parentGroupId);
}

// Delete Rule
function deleteRule(ruleId) {
	const $rule = $('#' + ruleId);
	const groupId = $rule.closest('.query-builder-group').attr('id');
	$rule.remove();

	// Update group badge state after deleting rule
	updateOperatorSwitchState(groupId);
}

// Delete Group
function deleteGroup(groupId) {
	const $group = $('#' + groupId);
	const parentId = $group.data('parent');

	$group.remove();

	// Update parent group badge state after deletion
	if (parentId) {
		updateOperatorSwitchState(parentId);
	}
}

// Get Query Object
function getQueryObject() {
	function parse($group) {
		const op = $group.find('> .group-header input[type=hidden]').val();
		const rules = [];
		$group.find('> .group-rules > *').each(function () {
			if ($(this).hasClass('rule-container')) {
				const id = $(this).attr('id');
				const typeVal = $('#' + id + '-type').val();
				const monitorVal = $('#' + id + '-monitor').val().trim();
				const operationVal = $('#' + id + '-operation').val();
				const valueVal = $('#' + id + '-value').val().trim();

				// Only include rules that have all required fields
				if (typeVal && monitorVal && operationVal && valueVal) {
					rules.push({
						type: typeVal,
						monitor: monitorVal,
						operation: operationVal,
						value: valueVal
					});
				}
			} else if ($(this).hasClass('query-builder-group')) {
				const nestedResult = parse($(this));
				// Only include nested groups that have rules
				if (nestedResult.rules && nestedResult.rules.length > 0) {
					rules.push(nestedResult);
				}
			}
		});

		return { condition: op, rules: rules };
	}

	const result = parse($('.query-builder-group').first());
	$('#query-output').text(JSON.stringify(result, null, 2));

	// Generate SQL statement in the simple format
	const sql = generateSimpleSQL(result);
	$('#sql-output').text(sql);
	return result;
}