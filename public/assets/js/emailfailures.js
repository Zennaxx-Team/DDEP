let companyOptionGlobalList = [],
	projectOptionsGloabalList = [],
	enviornmentOptionsGloabalList = [],
	itemOptionsGlobalList = [],
	viewFromDate = null,
	viewToDate = null


$(document).ready(async function () {
	let perPage = 50,
		currentPage = 1,
		maintable = null,
		totalLogRecords = [],
		selectedEmailIds = [],
		viewLogsItemId = '',
		viewLogsType = '',
		viewLogsPerPage = 50,
		viewLogsCurrentPage = 1,
		resViewlogTotalRecords = 0,
		viewLogsTable,
		viewNewLogsTable,
		logTypeModel = 'log_type';

	var start = moment().subtract(1440, 'minutes');
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

	function cb(start, end) {
		const drp = $('#emailfailuresrange').data('daterangepicker');
		let matchedLabel = null;

		for (const [label, range] of Object.entries(drp.ranges)) {
			if (start.isSame(range[0], 'second') && end.isSame(range[1], 'second')) {
				matchedLabel = label;
				break;
			}
		}

		if (matchedLabel) {
			$('#emailfailuresrange span').html(matchedLabel);
			$('.since-time').text(matchedLabel);
		} else {
			const formatted = start.format('MMMM D, YYYY HH:mm:ss') + ' - ' + end.format('MMMM D, YYYY HH:mm:ss');
			$('#emailfailuresrange span').html(formatted);
			$('.since-time').text('');
		}

		viewFromDate = start.toISOString();
		viewToDate = end.toISOString();
	}

	$('#emailfailuresrange').daterangepicker({
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

	cb(start, end);

	$('#emailfailuresrange').on('apply.daterangepicker', function (ev, picker) {
		if (picker.chosenLabel && picker.chosenLabel !== 'Custom Range') {
			$('#emailfailuresrange span').html(`${picker.chosenLabel}`);
			$('.since-time').text(`${picker.chosenLabel}`);
		} else {
			// For custom range or when no preset matched
			$('#emailfailuresrange span').html(
				picker.startDate.format('MMMM D, YYYY HH:mm:ss') + ' - ' + picker.endDate.format('MMMM D, YYYY HH:mm:ss')
			);
			$('.since-time').text('');
		}
	});

	// Utility function to reset dropdowns
	function resetSelect($select, placeholder = '-- Please Select --') {
		$select.empty().append(`<option value="">${placeholder}</option>`);
	}

	async function initializeAndFetchData() {
		await companyList();
		$('#select-email-company').val('all').trigger('change');

		setTimeout(() => {
			let companyId = $('#select-email-company').val() || 'all';
			let projectId = $('#select-email-project').val() || 'all';
			let environmentId = $('#select-email-environment').val() || 'all';
			let itemId = $('#select-email-item').val() || 'all';

			getdata(parseInt(perPage), parseInt(currentPage), companyId, projectId, environmentId, itemId, viewFromDate, viewToDate);
		}, 500)
	}

	initializeAndFetchData();

	async function companyList() {
		try {
			const responseCompanies = await getAllCompanies();
			if (responseCompanies.status === 1) {
				const $selectCompany = $('#select-email-company');
				resetSelect($selectCompany);

				$('<option>', { value: 'all', text: 'All' }).appendTo($selectCompany);

				$.each(responseCompanies.data, function (index, item) {
					$('<option>', {
						value: item._id,
						text: item.name,
						'data-name': item.name
					}).appendTo($selectCompany);
				});

				companyOptionGlobalList = responseCompanies.data || [];
			}
		} catch (error) {
			console.error('Error fetching companies:', error);
		}
	}

	function resetSelect($select, placeholder = '-- Please Select --') {
		$select.empty().append(`<option value="">${placeholder}</option>`);
	}

	const $selectCompany = $('#select-email-company');
	$selectCompany.on('change', async function () {

		const companyValue = $(this).val();
		resetSelect($('#select-email-project'));
		resetSelect($('#select-email-environment'));
		resetSelect($('#select-email-item'));

		if (companyValue === "all") {
			await projectListForAll();
		} else {
			await projectListForCompany(companyValue);
		}
	});

	async function projectListForCompany(companyId) {
		return getAllCompanyProjects(companyId).then(responseProjects => {
			if (responseProjects.status === 1) {
				const $selectProject = $('#select-email-project');
				resetSelect($selectProject);

				$('<option>', { value: 'all', text: 'All' }).appendTo($selectProject);
				$('<option>', { value: ' ', text: 'Default', 'data-name': 'Default' }).appendTo($selectProject);

				const filteredProjects = responseProjects.data.filter(p => p.companyId === companyId);
				$.each(filteredProjects, function (index, item) {
					$('<option>', {
						value: item._id,
						text: item.name,
						'data-name': item.name
					}).appendTo($selectProject);
				});

				projectOptionsGloabalList = responseProjects.data || [];
				$selectProject.val('all').trigger('change');
				return true;
			}
			throw new Error("Project list fetch failed");
		});
	}

	async function projectListForAll() {
		return getAllProjects().then(responseProjects => {
			if (responseProjects.status === 1) {
				const $selectProject = $('#select-email-project');
				resetSelect($selectProject);

				$('<option>', { value: 'all', text: 'All', selected: true }).appendTo($selectProject);
				$('<option>', { value: ' ', text: 'Default', 'data-name': 'Default' }).appendTo($selectProject);

				$.each(responseProjects.data, function (index, item) {
					$('<option>', {
						value: item._id,
						text: item.name,
						'data-name': item.name
					}).appendTo($selectProject);
				});

				projectOptionsGloabalList = responseProjects.data || [];
				$selectProject.val('all').trigger('change');
				return true;
			}
			throw new Error("Project list fetch failed");
		});
	}

	const $selectProject = $('#select-email-project');
	$selectProject.on('change', async function () {

		const projectValue = $(this).val();
		const companyValue = $('#select-email-company').val();
		resetSelect($('#select-email-environment'));

		if (projectValue === "all") {
			await environmentListForAll(companyValue);
			await itemList(companyValue, projectValue);
		} else {
			await environmentListForProject(companyValue, projectValue);
			await itemList(companyValue, projectValue, "");
		}
	});

	async function environmentListForAll(companyId) {
		const apiCall = companyId === "all"
			? getAllEnvironments()
			: getAllProjectEnvironments(companyId, "all");

		return apiCall.then(responseEnvironments => {
			if (responseEnvironments.status === 1) {
				const $selectEnvironment = $('#select-email-environment');
				resetSelect($selectEnvironment);

				$('<option>', { value: 'all', text: 'All', selected: true }).appendTo($selectEnvironment);

				$.each(responseEnvironments.data, function (index, item) {
					let displayText = item.name;
					const project = projectOptionsGloabalList.find(p => p._id === item.projectId);
					const projectName = project ? project.name : 'Default';
					displayText = `${projectName} - ${item.name}`;

					$('<option>', {
						value: item._id,
						text: displayText,
						'data-name': item.name
					}).appendTo($selectEnvironment);
				});

				enviornmentOptionsGloabalList = responseEnvironments.data || [];
				return true;
			}
			throw new Error("Environment fetch failed");
		});
	}

	async function environmentListForProject(companyId, projectId) {
		return getAllProjectEnvironments(companyId, projectId).then(responseEnvironments => {
			if (responseEnvironments.status === 1) {
				const $selectEnvironment = $('#select-email-environment');
				resetSelect($selectEnvironment);

				let filteredEnvironments = responseEnvironments.data;
				if (projectId && projectId !== 'all') {
					filteredEnvironments = filteredEnvironments.filter(env =>
						env.projectId === (projectId === " " ? null : projectId)
					);
				}

				$.each(filteredEnvironments, function (index, item) {
					$('<option>', {
						value: item._id,
						text: item.name,
						'data-name': item.name
					}).appendTo($selectEnvironment);
				});

				enviornmentOptionsGloabalList = responseEnvironments.data || [];
				return true;
			}
			throw new Error("Environment fetch failed");
		});
	}

	const $selectEnvironment = $('#select-email-environment');
	$selectEnvironment.on('change', async function () {
		const companyValue = $('#select-email-company').val();
		const projectValue = $('#select-email-project').val();
		const environmentValue = $(this).val();

		await itemList(companyValue, projectValue, environmentValue);
	});

	async function itemList(companyId, projectId, environmentId) {
		return getAllItemList(companyId, projectId, environmentId).then(responseItems => {
			if (responseItems.status === 1) {
				const $selectItems = $('#select-email-item');
				resetSelect($selectItems);

				$('<option>', { value: 'all', text: 'All', selected: true }).appendTo($selectItems);

				$.each(responseItems.data, function (index, item) {
					$('<option>', {
						value: item._id,
						text: item.ItemName,
						'data-name': item.name
					}).appendTo($selectItems);
				});

				itemOptionsGlobalList = responseItems.data || [];
				return true;
			}
			throw new Error("Item fetch failed");
		});
	}

	maintable = $('#email-failures-table').DataTable({
		order: [[3, 'desc']],
		aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
		iDisplayLength: perPage,
		pagingType: 'full_numbers',
		searching: false,
	});

	$('#email_select_all').on('change', function () {
		const isChecked = $(this).is(':checked');
		$('.email-checkbox').not('#email_select_all').prop('checked', isChecked);

		selectedEmailIds = [];
		if (isChecked) {
			$('.email-checkbox').not('#email_select_all').each(function () {
				selectedEmailIds.push($(this).data('email-id'));
			});
		}
		renderPaginationEmail(parseInt(currentPage), parseInt(perPage), totalLogRecords);
	});

	// Individual checkbox handler
	$(document).on('change', '.email-checkbox:not(#email_select_all)', function () {
		const $checkboxes = $('.email-checkbox').not('#email_select_all');
		const totalItems = $checkboxes.length;
		const checkedItems = $checkboxes.filter(':checked').length;

		selectedEmailIds = [];
		$checkboxes.filter(':checked').each(function () {
			selectedEmailIds.push($(this).data('email-id'));
		});

		$('#email_select_all').prop('checked', totalItems === checkedItems && totalItems > 0);
	});

	$('body').on('click', '#email-failures-table_paginate .paginate_button', function () {
		const pageNo = parseInt($(this).data('pageno'));
		if (!pageNo || pageNo === parseInt(currentPage)) return;
		currentPage = pageNo;
		maintable.clear();
		maintable.destroy();
		$('#email-failures-table tbody').empty();
		maintable = $('#email-failures-table').DataTable({
			order: [[3, 'desc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			searching: false,
		});

		let companyId = $('#select-email-company').val();
		let projectId = $('#select-email-project').val();
		let environmentId = $('#select-email-environment').val();
		let itemId = $('#select-email-item').val();

		getdata(parseInt(perPage), parseInt(currentPage), companyId, projectId, environmentId, itemId, viewFromDate, viewToDate);
	});

	$('body').on('change', '#email-failures-table_length select', function () {
		perPage = parseInt($(this).val());
		currentPage = 1;
		maintable.clear();
		maintable.destroy();
		maintable = $('#email-failures-table').DataTable({
			order: [[3, 'desc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			searching: false,
		});

		let companyId = $('#select-email-company').val();
		let projectId = $('#select-email-project').val();
		let environmentId = $('#select-email-environment').val();
		let itemId = $('#select-email-item').val();

		getdata(parseInt(perPage), parseInt(currentPage), companyId, projectId, environmentId, itemId, viewFromDate, viewToDate);
	});

	$('body').on('click', '#search-email-button', function () {
		let companyId = $('#select-email-company').val();
		let projectId = $('#select-email-project').val();
		let environmentId = $('#select-email-environment').val();
		let itemId = $('#select-email-item').val();
		currentPage = 1;
		getdata(parseInt(perPage), parseInt(currentPage), companyId, projectId, environmentId, itemId, viewFromDate, viewToDate);
	});

	function getdata(perPage, currentPage, companyId, projectId, environmentId, itemId, fromDate, toDate) {
		$('#email-failures-table tbody').empty();
		$('#email-failures-table tbody').html('<tr class="odd"><td valign="top" colspan="11" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

		$.ajax({
			url: '/email-failures/list',
			method: 'post',
			dataType: 'json',
			data: { page: parseInt(currentPage), limit: parseInt(perPage), companyId, projectId, environmentId, itemId, fromDate, toDate },
			success: function (response) {
				let counter = ((parseInt(currentPage) - 1) * parseInt(perPage)) + 1;
				let totalRecord = parseInt(response.total);
				totalLogRecords = totalRecord;

				maintable.clear();

				if (response.data.length === 0) {
					// show "no data" message via DataTables
					maintable.draw(false);
					$('.overlay, body').addClass('loaded');
					$('.overlay').hide();
					return;
				}

				$.each(response.data, function (index, data) {
					let $checkbox = '<div class="custom-control custom-checkbox mt-0">' +
						'<input type="checkbox" name="email_select_' + data._id + '" id="email_select_' + data._id + '" class="custom-control-input email-checkbox" data-email-id="' + data._id + '" aria-label="Select Item">' +
						'<label class="custom-control-label" for="email_select_' + data._id + '"></label>' +
						'</div>';
					const startDate = new Date(data.dateTime);
					const startYear = startDate.getFullYear();
					const startMonth = startDate.getMonth() + 1;
					const startDay = startDate.getDate();
					const startHours = (startDate.getHours() < 10 ? '0' : '') + startDate.getHours();
					const startMinutes = (startDate.getMinutes() < 10 ? '0' : '') + startDate.getMinutes();
					const startSeconds = (startDate.getSeconds() < 10 ? '0' : '') + startDate.getSeconds();
					const startMilliseconds = (startDate.getMilliseconds() < 10 ? '00' : (startDate.getMilliseconds() < 100 ? '0' : '')) + startDate.getMilliseconds();
					const startTime = startYear + '-' + (startMonth < 10 ? '0' : '') + startMonth + '-' + (startDay < 10 ? '0' : '') + startDay + ' ' + startHours + ':' + startMinutes + ':' + startSeconds + '.' + startMilliseconds;

					let $resendMessageIcon = data?.resendMessage
						? `<div class="btn-group" role="group" aria-label="Basic example">
                                <button type="button" class="btn btn-outline-secondary resend-message-eye" data-toggle="tooltip" title="View" data-message="${encodeURIComponent(data.resendMessage)}"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>
                            </div>`
						: `<div class="w-100"></div>`; // empty cell if no message

					// let $button_group = '<div class="btn-group" role="group" aria-label="Basic example">';
					// $button_group += '<button type="button" class="btn btn-outline-secondary view-item-logs-modal" data-toggle="tooltip" title="View" data-id="' + data.unique_id + '"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>';
					// $button_group += '</div>';

					const rowNode = maintable.row.add([
						$checkbox,
						counter++,
						startTime,
						data.companyName || '',
						data.projectName,
						data?.item_details?.ItemName || '',
						data?.subject || '',
						data?.resendTime || 0,
						data?.latestStatus || "Fail",
						data?.failureReason || '',
						$resendMessageIcon,
						// $button_group
					]).draw(false).node();

					$(rowNode).data('originalData', data);
				})

				$('#email-failures-table tbody').off('mouseenter mouseleave click'); // remove previous handlers
				$('#email-failures-table tbody').on('mouseenter', 'tr', function () {
					$(this).css({
						'background-color': '#8DC454',
						'color': '#ffffff',
						'cursor': 'pointer' // arrow pointer
					});
				});
				$('#email-failures-table tbody').on('mouseleave', 'tr', function () {
					$(this).css({
						'background-color': '',
						'color': '#6E6B7B',
						'cursor': 'default'
					});
				});

				$('#email-failures-table tbody').on('click', 'tr td:not(:first-child):not(:last-child)', function () {
					const rowData = $(this).closest('tr').data('originalData');
					openDetailsLogs(rowData);
				});

				$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
				let startEntry = (parseInt(currentPage) == 1) ? 1 : ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1);
				let endEntry = (parseInt(currentPage) == 1) ? parseInt(perPage) : (parseInt(perPage) * parseInt(currentPage));
				endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

				if (totalRecord == 0) {
					startEntry = 0;
				}

				let showpage = 'Showing ' + startEntry + ' to ' + endEntry + ' of ' + totalRecord + ' entries';
				$('body').find('#email-failures-table_info').html(showpage);

				renderPaginationEmail(parseInt(currentPage), parseInt(perPage), totalRecord);
			},
			error: function (response) {
				console.log(response);
				alert('server error');
			}
		});
	}

	function openDetailsLogs(rowData) {
		if (rowData.mail_type == "alert_type") {
			resetLogViews();
			logTypeModel = 'alert_type'
			viewLogsItemId = rowData.unique_id;
			oldViewLogDataForHistory(viewLogsPerPage, viewLogsCurrentPage, rowData.unique_id)
		} else {
			logTypeModel = 'log_type'
			viewLogsItemId = rowData.unique_id;
			viewLogsType = rowData.type;
			viewLogsCurrentPage = 1;
			if (viewNewLogsTable) {
				viewNewLogsTable.clear();
				viewNewLogsTable.destroy();
			}

			viewNewLogsTable = $('#view-new-logs-data-table').DataTable({
				ordering: false,
				paging: false,
				searching: false,
				info: false,
				lengthChange: false,
			});

			itemLogPage = true;
			getViewLogsData(viewLogsPerPage, viewLogsCurrentPage, viewLogsItemId, viewLogsType);
		}
	}

	$('body').on('click', '.resend-message-eye', function () {
		const message = decodeURIComponent($(this).data('message'));
		$('#email-failures-details-modal-body').text(message);
		$('#email-failures-details-view-modal-slide-in').modal('show');
	});

	function renderPaginationEmail(currentPage, perPage, totalRecord) {
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

		$('#email-failures-table_paginate').html(paginationHtml);
	}

	$('body').on('click', '#email-resend', function () {
		selectedEmailIds = [];
		$('.email-checkbox').not('#email_select_all').filter(':checked').each(function () {
			selectedEmailIds.push($(this).data('email-id'));
		});
		const selectedCount = selectedEmailIds.length;

		if (selectedCount === 0) {
			Swal.fire({
				title: 'Warning!',
				text: 'Please select at least one email to send.',
				icon: 'warning',
				customClass: { confirmButton: 'btn btn-primary' },
				buttonsStyling: false,
				timer: 1200
			});
			return;
		}

		if (selectedCount > 0) {
			$.ajax({
				url: `/email-failures/resend`,
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ emailIds: selectedEmailIds }),
				success: function (response) {
					if (response.status == 1) {


						$('#email_select_all').prop('checked', false).trigger('change');
						$('.email-checkbox').not('#email_select_all').prop('checked', false).trigger('change');
						selectedEmailIds = [];

						if ($.fn.uniform) {
							$.uniform.update('.email-checkbox');
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

	})

	$('body').on('click', '#email-delete', function () {
		let selectedEmailIds = [];
		$('.email-checkbox').not('#email_select_all').filter(':checked').each(function () {
			selectedEmailIds.push($(this).data('email-id'));
		});
		const selectedCount = selectedEmailIds.length;

		if (selectedCount === 0) {
			Swal.fire({
				title: 'Warning!',
				text: 'Please select at least one email to delete.',
				icon: 'warning',
				customClass: { confirmButton: 'btn btn-primary' },
				buttonsStyling: false,
				timer: 1200
			});
			return;
		}

		// Confirm delete
		Swal.fire({
			title: 'Are you sure?',
			text: `You are about to delete ${selectedCount} email(s).`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'Yes, delete!',
			cancelButtonText: 'Cancel',
			customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary ml-1' },
			buttonsStyling: false
		}).then((result) => {
			if (result.isConfirmed) {
				$.ajax({
					url: `/email-failures/delete`,
					method: 'POST',
					contentType: 'application/json',
					data: JSON.stringify({ emailIds: selectedEmailIds }),
					success: function (response) {
						if (response.status == 1) {
							$('#email_select_all').prop('checked', false).trigger('change');
							$('.email-checkbox').not('#email_select_all').prop('checked', false).trigger('change');
							selectedEmailIds = [];

							if ($.fn.uniform) {
								$.uniform.update('.email-checkbox');
							}

							Swal.fire({
								title: 'Success!',
								text: response.message,
								icon: 'success',
								customClass: { confirmButton: 'btn btn-primary' },
								buttonsStyling: false,
								timer: 1200
							});
						} else {
							Swal.fire({
								title: 'Error!',
								text: response.message,
								icon: 'error',
								customClass: { confirmButton: 'btn btn-primary' },
								buttonsStyling: false,
								timer: 1200
							});
						}

						let companyId = $('#select-email-company').val();
						let projectId = $('#select-email-project').val();
						let environmentId = $('#select-email-environment').val();
						let itemId = $('#select-email-item').val();
						currentPage = 1;
						getdata(parseInt(perPage), parseInt(currentPage), companyId, projectId, environmentId, itemId, viewFromDate, viewToDate);

						// Hide overlay
						$('.overlay, body').addClass('loaded');
						$('.overlay').css({ 'display': 'none' });
					},
					error: function (xhr, status, error) {
						$('.overlay, body').addClass('loaded');
						$('.overlay').css({ 'display': 'none' });

						Swal.fire({
							title: 'Error!',
							text: xhr?.responseJSON?.message || 'Something went wrong.',
							icon: 'error',
							customClass: { confirmButton: 'btn btn-primary' },
							buttonsStyling: false,
							timer: 1200
						});
					}
				});
			} else {
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });
			}
		});
	});


	if (viewNewLogsTable) {
		viewNewLogsTable.clear().draw();
		viewNewLogsTable.destroy();
		viewNewLogsTable = $('#view-new-logs-data-table').DataTable({
			ordering: false,
			paging: false,
			searching: false,
			info: false,
			lengthChange: false,
		});
	}

	if (viewLogsTable) {
		viewLogsTable.clear().draw();
		viewLogsTable.destroy();
		viewLogsTable = $('#view-logs-data-table').DataTable({
			order: [[5, 'asc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: viewLogsPerPage,
			pagingType: 'full_numbers',
			searching: false,
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
	}

	$('body').on('click', 'button.view-item-logs-modal', function () {
		viewLogsItemId = $(this).attr('data-id');
		viewLogsType = $(this).attr('data-type');

		viewLogsCurrentPage = 1;
		if (viewNewLogsTable) {
			viewNewLogsTable.clear();
			viewNewLogsTable.destroy();
		}

		viewNewLogsTable = $('#view-new-logs-data-table').DataTable({
			ordering: false,
			paging: false,
			searching: false,
			info: false,
			lengthChange: false,
		});

		itemLogPage = true;
		getViewLogsData(viewLogsPerPage, viewLogsCurrentPage, viewLogsItemId, viewLogsType);
	});

	if (viewLogsTable) {
		viewLogsTable.on('draw', function () {
			const perPage = viewLogsTable.page.info().length;
			viewLogsPaginaiton(perPage, viewLogsCurrentPage, resViewlogTotalRecords);
		});
	}

	$('body').on('click', '#view-logs-data-table_paginate .paginate_button', function () {
		viewLogsCurrentPage = $(this).attr('data-pageno');
		if ($.fn.DataTable.isDataTable('#view-logs-data-table')) {
			$('#view-logs-data-table').DataTable().clear().destroy();
		}
		if (logTypeModel == "log_type") {
			oldViewLogData(parseInt(viewLogsPerPage), parseInt(viewLogsCurrentPage), viewLogsItemId);
		} else {
			oldViewLogDataForHistory(parseInt(viewLogsPerPage), parseInt(viewLogsCurrentPage), viewLogsItemId)
		}

	});

	$('body').on('change', '#view-logs-data-table_length select', function () {
		viewLogsPerPage = $('#view-logs-data-table_length select').val();
		viewLogsCurrentPage = 1;
		if ($.fn.DataTable.isDataTable('#view-logs-data-table')) {
			$('#view-logs-data-table').DataTable().clear().destroy();
		}
		if (logTypeModel == "log_type") {
			oldViewLogData(parseInt(viewLogsPerPage), parseInt(viewLogsCurrentPage), viewLogsItemId);
		} else {
			oldViewLogDataForHistory(parseInt(viewLogsPerPage), parseInt(viewLogsCurrentPage), viewLogsItemId)
		}
	});

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
		if (dataObject?.description == "User Posting Data" || dataObject?.description == "Mapped Data" || dataObject?.description == "Response Data" || dataObject.description == "CURL Bash") {
			$('#copy-content-btn').show();
		} else {
			$('#copy-content-btn').hide();
		}
		$('#log-req-res-request').attr('data-uniqueid-curl-request', formattedData);
		$('#details-modal-body').show();
		$('#table-content').hide();
		$('#view-item-logs-details-modal-slide-in').modal('show');
	});

	$('#log-details-page').on('click', function () {
		let uniqueId = $(this).attr('data-uniqueid-log');
		resetLogViews();
		oldViewLogData(viewLogsPerPage, viewLogsCurrentPage, uniqueId)
	});

	$('#log-curl-request').on('click', function () {
		let curlRequest = $(this).attr('data-uniqueid-curl-request');
		$('#details-curl-base').text(curlRequest);
		$('#view-curl-bash-slide-in').modal('show');
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
					timer: 20000
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
					timer: 20000
				});
			});
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

	function resetLogViews() {
		// $('#view-new-item-logs-modal-slide-in').modal('show');
		$('.overlay, body').removeClass('loaded');
		$('.overlay').css({ 'display': 'block' });
		if (viewLogsTable) {
			viewLogsTable.clear().draw();
			viewLogsTable.destroy();
		}
		if (emailLogsTable_log) {
			$("#table-content").empty();
			emailLogsTable_log.clear().draw();
		}
		viewLogsPerPage = 50,
			viewLogsCurrentPage = 1,
			viewLogsItemId = null;
		viewLogsType = null;
	}

	async function oldViewLogData(perPage, currentPage, uniqueId) {
		viewLogsTable = $('#view-logs-data-table').DataTable({
			order: [[5, 'asc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: viewLogsPerPage,
			pagingType: 'full_numbers',
			searching: false,
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

	async function oldViewLogDataForHistory(perPage, currentPage, uniqueId) {
		viewLogsTable = $('#view-logs-data-table').DataTable({
			order: [[5, 'asc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: viewLogsPerPage,
			pagingType: 'full_numbers',
			searching: false,
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
		await $.ajax({
			url: '/alerts/alert-history/get/' + uniqueId,
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ page: parseInt(currentPage), limit: parseInt(perPage) }),
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
						data.trigger_by,
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
						$button_group_request += createViewButtonForLogs(request.datas);
					}
					if (inboundMail?.length) {
						$button_group_request += createEmailButtonForLogs(inboundMail);
					}
					$button_group_request += '</div>';

					let $button_group_transformed_request = '';
					$button_group_transformed_request = '<div class="btn-group-vertical text-center" role="group">';
					if (transformed_request && transformed_request.datas) {
						$button_group_transformed_request += createViewButtonForLogs(transformed_request.datas);
					}
					if (transformed_request && transformed_request.message) {
						$button_group_transformed_request += `<span class="text-center mt-1 w-100">${transformed_request.message}</span>`;
					}
					$button_group_transformed_request += '</div>';

					let $button_group_request_filter = '<div class="btn-group-vertical text-center" role="group">';
					if (request_filter?.datas) {
						$button_group_request_filter += createViewButtonForLogs(request_filter.datas);
					}
					if (request_filter?.message) {
						$button_group_request_filter += `<span class="text-center mt-1 w-100">${request_filter.message}</span>`;
					}
					$button_group_request_filter += '</div>';

					let $button_group_validation = '<div class="btn-group-vertical text-center" role="group">';
					if (validation?.datas) {
						$button_group_validation += createViewButtonForLogs(validation.datas);
					}
					if (validation?.message) {
						$button_group_validation += `<span class="text-center mt-1 w-100">${validation.message}</span>`;
					}
					$button_group_validation += '</div>';

					// Trigger Rule
					let $button_group_trigger_rule = '<div class="btn-group-vertical text-center" role="group">';
					if (trigger_rule?.datas) {
						$button_group_trigger_rule += createViewButtonForLogs(trigger_rule.datas);
					}
					if (trigger_rule?.message) {
						$button_group_trigger_rule += `<span class="text-center mt-1 w-100">${trigger_rule.message}</span>`;
					}
					$button_group_trigger_rule += '</div>';

					// Request Return URL
					let $button_group_request_return_url = '<div class="btn-group-vertical text-center" role="group">';
					if (request_return_url?.datas) {
						$button_group_request_return_url += createViewButtonForLogs(request_return_url.datas);
					}
					if (request_return_url?.message) {
						$button_group_request_return_url += `<span class="text-center mt-1 w-100">${request_return_url.message}</span>`;
					}
					$button_group_request_return_url += '</div>';

					// Curl Base
					let $button_group_curl_base = '<div class="btn-group-vertical text-center" role="group">';
					if (outbound_entrypoint?.datas) {
						$button_group_curl_base += createViewButtonForLogs(outbound_entrypoint.datas, "curl");
					}
					if (outbound_entrypoint?.message) {
						$button_group_curl_base += `<span class="text-center mt-1 w-100">${outbound_entrypoint.message}</span>`;
					}
					$button_group_curl_base += '</div>';


					// Response
					let $button_group_response = '<div class="btn-group-vertical text-center" role="group">';
					if (response?.datas) {
						$button_group_response += createViewButtonForLogs(response.datas);
						$button_group_response += createEmailButtonForLogs(outboundMail);
					}
					if (response?.message) {
						$button_group_response += `<span class="text-center mt-1 w-100">${response.message}</span>`;
					}
					$button_group_response += '</div>';

					// Transformed Response
					let $button_group_transformed_response = '<div class="btn-group-vertical text-center" role="group">';
					if (transformed_response?.datas) {
						$button_group_transformed_response += createViewButtonForLogs(transformed_response.datas);
					}
					if (transformed_response?.message) {
						$button_group_transformed_response += `<span class="text-center mt-1 w-100">${transformed_response.message}</span>`;
					}
					$button_group_transformed_response += '</div>';

					// Response Filter
					let $button_group_response_filter = '<div class="btn-group-vertical text-center" role="group">';
					if (response_filter?.datas) {
						$button_group_response_filter += createViewButtonForLogs(response_filter.datas);
					}
					if (response_filter?.message) {
						$button_group_response_filter += `<span class="text-center mt-1 w-100">${response_filter.message}</span>`;
					}
					$button_group_response_filter += '</div>';

					// Response Validation
					let $button_group_response_validation = '<div class="btn-group-vertical text-center" role="group">';
					if (response_validation?.datas) {
						$button_group_response_validation += createViewButtonForLogs(response_validation.datas);
					}
					if (response_validation?.message) {
						$button_group_response_validation += `<span class="text-center mt-1 w-100">${response_validation.message}</span>`;
					}
					$button_group_response_validation += '</div>';

					// Response Return URL
					let $button_group_response_return_url = '<div class="btn-group-vertical text-center" role="group">';
					if (response_return_url?.datas) {
						$button_group_response_return_url += createViewButtonForLogs(response_return_url.datas);
					}
					if (response_return_url?.message) {
						$button_group_response_return_url += `<span class="text-center mt-1 w-100">${response_return_url.message}</span>`;
					}
					$button_group_response_return_url += '</div>';

					// Response Failure Return URL
					let $button_group_response_failure_return_url = '<div class="btn-group-vertical text-center" role="group">';
					if (response_failure_url?.datas) {
						$button_group_response_failure_return_url += createViewButtonForLogs(response_failure_url.datas);
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
							$button_group_request += createViewButtonForLogs(request.datas);
						}
						if (inboundMail?.length) {
							$button_group_request += createEmailButtonForLogs(inboundMail);
						}
						$button_group_request += '</div>';

						let $button_group_transformed_request = '';
						$button_group_transformed_request = '<div class="btn-group-vertical text-center" role="group">';
						if (transformed_request && transformed_request.datas) {
							$button_group_transformed_request += createViewButtonForLogs(transformed_request.datas);
						}
						if (transformed_request && transformed_request.message) {
							$button_group_transformed_request += `<span class="text-center mt-1 w-100">${transformed_request.message}</span>`;
						}
						$button_group_transformed_request += '</div>';

						let $button_group_request_filter = '<div class="btn-group-vertical text-center" role="group">';
						if (request_filter?.datas) {
							$button_group_request_filter += createViewButtonForLogs(request_filter.datas);
						}
						if (request_filter?.message) {
							$button_group_request_filter += `<span class="text-center mt-1 w-100">${request_filter.message}</span>`;
						}
						$button_group_request_filter += '</div>';

						let $button_group_validation = '<div class="btn-group-vertical text-center" role="group">';
						if (validation?.datas) {
							$button_group_validation += createViewButtonForLogs(validation.datas);
						}
						if (validation?.message) {
							$button_group_validation += `<span class="text-center mt-1 w-100">${validation.message}</span>`;
						}
						$button_group_validation += '</div>';

						// Trigger Rule
						let $button_group_trigger_rule = '<div class="btn-group-vertical text-center" role="group">';
						if (trigger_rule?.datas) {
							$button_group_trigger_rule += createViewButtonForLogs(trigger_rule.datas);
						}
						if (trigger_rule?.message) {
							$button_group_trigger_rule += `<span class="text-center mt-1 w-100">${trigger_rule.message}</span>`;
						}
						$button_group_trigger_rule += '</div>';

						// Request Return URL
						let $button_group_request_return_url = '<div class="btn-group-vertical text-center" role="group">';
						if (request_return_url?.datas) {
							$button_group_request_return_url += createViewButtonForLogs(request_return_url.datas);
						}
						if (request_return_url?.message) {
							$button_group_request_return_url += `<span class="text-center mt-1 w-100">${request_return_url.message}</span>`;
						}
						$button_group_request_return_url += '</div>';

						// Curl Base
						let $button_group_curl_base = '<div class="btn-group-vertical text-center" role="group">';
						if (outbound_entrypoint?.datas) {
							$button_group_curl_base += createViewButtonForLogs(outbound_entrypoint.datas, "curl");
						}
						if (outbound_entrypoint?.message) {
							$button_group_curl_base += `<span class="text-center mt-1 w-100">${outbound_entrypoint.message}</span>`;
						}
						$button_group_curl_base += '</div>';


						// Response
						let $button_group_response = '<div class="btn-group-vertical text-center" role="group">';
						if (response?.datas) {
							$button_group_response += createViewButtonForLogs(response.datas);
						}
						if (outboundMail?.length) {
							$button_group_response += createEmailButtonForLogs(outboundMail);
						}
						if (response?.message) {
							$button_group_response += `<span class="text-center mt-1 w-100">${response.message}</span>`;
						}
						$button_group_response += '</div>';

						// Transformed Response
						let $button_group_transformed_response = '<div class="btn-group-vertical text-center" role="group">';
						if (transformed_response?.datas) {
							$button_group_transformed_response += createViewButtonForLogs(transformed_response.datas);
						}
						if (transformed_response?.message) {
							$button_group_transformed_response += `<span class="text-center mt-1 w-100">${transformed_response.message}</span>`;
						}
						$button_group_transformed_response += '</div>';

						// Response Filter
						let $button_group_response_filter = '<div class="btn-group-vertical text-center" role="group">';
						if (response_filter?.datas) {
							$button_group_response_filter += createViewButtonForLogs(response_filter.datas);
						}
						if (response_filter?.message) {
							$button_group_response_filter += `<span class="text-center mt-1 w-100">${response_filter.message}</span>`;
						}
						$button_group_response_filter += '</div>';

						// Response Validation
						let $button_group_response_validation = '<div class="btn-group-vertical text-center" role="group">';
						if (response_validation?.datas) {
							$button_group_response_validation += createViewButtonForLogs(response_validation.datas);
						}
						if (response_validation?.message) {
							$button_group_response_validation += `<span class="text-center mt-1 w-100">${response_validation.message}</span>`;
						}
						$button_group_response_validation += '</div>';

						// Response Return URL
						let $button_group_response_return_url = '<div class="btn-group-vertical text-center" role="group">';
						if (response_return_url?.datas) {
							$button_group_response_return_url += createViewButtonForLogs(response_return_url.datas);
						}
						if (response_return_url?.message) {
							$button_group_response_return_url += `<span class="text-center mt-1 w-100">${response_return_url.message}</span>`;
						}
						$button_group_response_return_url += '</div>';

						// Response Failure Return URL
						let $button_group_response_failure_return_url = '<div class="btn-group-vertical text-center" role="group">';
						if (response_failure_url?.datas) {
							$button_group_response_failure_return_url += createViewButtonForLogs(response_failure_url.datas);
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

});

async function openLogDescriptionModal(element) {
	const $element = $(element);
	const itemId = $element.data('item-id') || '';
	const unique_id = $element.data('unique-id') || '';
	const log_description = $element.data('log-description') || '';
	// const plainDescription = log_description.replace(/<br\s*\/?>/gi, '\r\n');
	const plainDescription = log_description
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/<br\s*\/?>/gi, '\r\n');

	if (!itemId && !unique_id) return;
	$('#log-description-value').val(plainDescription);
	$('#log-unique-id').val(unique_id);
	$('#log-description-modal-slide-in').modal('show');
}

function createViewButtonForLogs(datas, request) {
	if (!datas) return '';

	let parsedDatas;
	try {
		parsedDatas = typeof datas === 'string' ? JSON.parse(datas) : datas;
	} catch (e) {
		parsedDatas = datas;
	}

	// Safely stringify and escape quotes for HTML attribute
	const requestJson = JSON.stringify(parsedDatas).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

	return `<button type="button" class="btn btn-outline-secondary" data-toggle="tooltip" title="View" data-request='${requestJson}' data-curl='${request}' onclick="viewItemLogDetailsModelForLogs(this.getAttribute('data-request'), this.getAttribute('data-curl'))">
		<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>`;
}

function createEmailButtonForLogs(datas) {
	if (!datas) return '';
	return `<button type="button" class="btn btn-outline-secondary mt-1" data-toggle="tooltip" title="View" data-request='${JSON.stringify(datas)}' onclick="viewEmailLogDetailsForLogs(this.getAttribute('data-request'))">
		<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" 
			viewBox="0 0 24 24" fill="none" stroke="currentColor" 
			stroke-width="2" stroke-linecap="round" stroke-linejoin="round" 
			class="feather feather-mail">
			<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4
			c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
			<polyline points="22,6 12,13 2,6"></polyline>
		</svg></button>`;
}

function viewItemLogDetailsModelForLogs(datasString, curl) {
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

let emailLogsTable_log; // renamed from viewLogsTable

function viewEmailLogDetailsForLogs(emailLogs) {
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
	emailLogsTable_log = $('#email-logs-table').DataTable({
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

		emailLogsTable_log.row.add([
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
