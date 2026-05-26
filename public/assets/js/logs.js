let companyOptionGlobalList = [],
	projectOptionsGloabalList = [],
	enviornmentOptionsGloabalList = [],
	itemOptionsGlobalList = [],
	viewFromDate = null,
	viewToDate = null,
	isRestoringFromCookie = false;

$(document).ready(async function () {
	let perPage = 50,
		currentPage = 1,
		viewLogsItemId = '',
		viewLogsType = '',
		viewLogsPerPage = 50,
		viewLogsCurrentPage = 1,
		resViewlogTotalRecords = 0,
		viewLogsTable,
		viewNewLogsTable,
		fTable,
		qTable,
		reviewedTable,
		rPerPage = 50,
		rcurrentPage = 1,
		fperPage = 50,
		fcurrentPage = 1,
		qperPage = 50,
		qcurrentPage = 1,
		selectedUniqueIds = [],
		totalLogRecords = [],
		reviwedUniqueId = null;

	maintable = $('#logs_data_table').DataTable({
		order: [[10, 'desc']],
		aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
		iDisplayLength: perPage,
		pagingType: 'full_numbers',
		searching: false,
		aoColumns: [
			null,
			null,
			null,
			null,
			{ 'sClass': 'line-break-anywhare' },
			{ width: "200px" },
			null,
			null,
			null,
			null,
			null,
			null,
			null
		]
	});

	var start = moment().subtract(1440, 'minutes').startOf('second');
	var end = moment().startOf('second');

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
		ranges[label] = [
			moment().subtract(minutes, 'minutes').startOf('second'),
			moment().startOf('second')
		];
	}

	function cb(start, end) {
		const drp = $('#reportrange').data('daterangepicker');
		let matchedLabel = null;

		for (const [label, range] of Object.entries(drp.ranges)) {
			if (start.isSame(range[0], 'second') && end.isSame(range[1], 'second')) {
				matchedLabel = label;
				break;
			}
		}

		if (matchedLabel) {
			$('#reportrange span').html(matchedLabel);
			$('.since-time').text(matchedLabel);
		} else {
			const formatted = start.format('MMMM D, YYYY HH:mm:ss') + ' - ' + end.format('MMMM D, YYYY HH:mm:ss');
			$('#reportrange span').html(formatted);
			$('.since-time').text('');
		}

		viewFromDate = start.toISOString();
		viewToDate = end.toISOString();
	}

	$('#reportrange').daterangepicker({
		timePicker: true,
		timePicker24Hour: true,
		timePickerSeconds: true,
		startDate: start,
		endDate: end,
		locale: {
			format: 'MMMM D, YYYY HH:mm:ss'
		},
		ranges: ranges
	}, cb);

	cb(start, end);

	$('#reportrange').on('apply.daterangepicker', function (ev, picker) {
		cb(picker.startDate, picker.endDate);
	});

	const form = document.getElementById('logs_import');
	function submitForm(e) {
		e.preventDefault();
		$('.overlay, body').removeClass('loaded');
		$('.overlay').css({ 'display': 'block' });

		const files = document.getElementById('log_file');
		const formData = new FormData();
		for (let i = 0; i < files.files.length; i++) {
			formData.append('file', files.files[i]);
		}

		fetch('/file/upload', {
			method: 'POST',
			body: formData,
		})
			.then((res) => res.text())
			.then((text) => {
				let response = JSON.parse(text);
				if (response.status == 1) {
					$.ajax({
						url: '/logs/import',
						method: 'post',
						dataType: 'json',
						data: { filename: response.filename },
						success: function (response) {
							if (response.status == 1) {
								document.getElementById('logs_import').reset();
								$('#import_logs_history button.close').trigger('click');
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({ 'display': 'none' });
								swal({
									title: 'Success!',
									text: response.message,
									type: 'success',
									timer: 1200
								});
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({ 'display': 'none' });
								swal({
									title: 'Error!',
									text: response.message,
									type: 'error',
									timer: 3000
								});
							}
						},
						error: function (response) {
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({ 'display': 'none' });
							alert('server error');
						}
					});
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
			})
			.catch((err) => {
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });
			});
	}

	// Utility function to reset dropdowns
	function resetSelect($select, placeholder = '-- Please Select --') {
		$select.empty().append(`<option value="">${placeholder}</option>`);
	}

	function waitForOption($select, value, timeout = 2000) {
		return new Promise((resolve, reject) => {
			const start = Date.now();
			const check = () => {
				const exists = $select.find('option').toArray().some(opt => String(opt.value) === String(value));
				if (exists) {
					$select.val(value).trigger('change');
					resolve(true);
				} else if (Date.now() - start >= timeout) {
					reject(`Option '${value}' not found in select #${$select.attr('id')}`);
				} else {
					setTimeout(check, 100);
				}
			};
			check();
		});
	}

	async function initializeAndFetchData() {
		await companyList();
		const condition = getCookieJSON('logsCondition');
		if (condition) {
			await restoreFilterFromCookie();
		} else {
			$('#select-log-company').val('all').trigger('change');
		}
	}

	initializeAndFetchData();

	async function companyList() {
		try {
			const responseCompanies = await getAllCompanies();
			if (responseCompanies.status === 1) {
				const $selectCompany = $('#select-log-company');
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

	const $selectCompany = $('#select-log-company');
	$selectCompany.on('change', async function () {
		if (isRestoringFromCookie) return;

		const companyValue = $(this).val();
		resetSelect($('#select-log-project'));
		resetSelect($('#select-log-environment'));
		resetSelect($('#select-log-item'));

		if (companyValue === "all") {
			await projectListForAll(false);
		} else {
			await projectListForCompany(companyValue, false);
		}
	});

	async function projectListForCompany(companyId, skipAutoSelect = false) {
		return getAllCompanyProjects(companyId).then(responseProjects => {
			if (responseProjects.status === 1) {
				const $selectProject = $('#select-log-project');
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
				if (!skipAutoSelect) {
					$selectProject.val('all').trigger('change');
				}
				return true;
			}
			throw new Error("Project list fetch failed");
		});
	}

	async function projectListForAll(skipAutoSelect = false) {
		return getAllProjects().then(responseProjects => {
			if (responseProjects.status === 1) {
				const $selectProject = $('#select-log-project');
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
				if (!skipAutoSelect) {
					$selectProject.val('all').trigger('change');
				}
				return true;
			}
			throw new Error("Project list fetch failed");
		});
	}

	const $selectProject = $('#select-log-project');
	$selectProject.on('change', async function () {
		if (isRestoringFromCookie) return;

		const projectValue = $(this).val();
		const companyValue = $('#select-log-company').val();
		resetSelect($('#select-log-environment'));

		if (projectValue === "all") {
			await environmentListForAll(companyValue, false);
			await itemList(companyValue, projectValue, "", false);
		} else {
			await environmentListForProject(companyValue, projectValue, false);
			await itemList(companyValue, projectValue, "", false);
		}
	});

	async function environmentListForAll(companyId, skipAutoSelect = false) {
		const apiCall = companyId === "all"
			? getAllEnvironments()
			: getAllProjectEnvironments(companyId, "all");

		return apiCall.then(responseEnvironments => {
			if (responseEnvironments.status === 1) {
				const $selectEnvironment = $('#select-log-environment');
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
				if (!skipAutoSelect) {
					$selectEnvironment.val('all').trigger('change');
				}

				return true;
			}
			throw new Error("Environment fetch failed");
		});
	}

	async function environmentListForProject(companyId, projectId, skipAutoSelect = false) {
		return getAllProjectEnvironments(companyId, projectId).then(responseEnvironments => {
			if (responseEnvironments.status === 1) {
				const $selectEnvironment = $('#select-log-environment');
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

				if (!skipAutoSelect) {
					$selectEnvironment.val('all').trigger('change');
				}
				return true;
			}
			throw new Error("Environment fetch failed");
		});
	}

	const $selectEnvironment = $('#select-log-environment');
	$selectEnvironment.on('change', async function () {
		if (isRestoringFromCookie) return;

		const companyValue = $('#select-log-company').val();
		const projectValue = $('#select-log-project').val();
		const environmentValue = $(this).val();

		await itemList(companyValue, projectValue, environmentValue, false);
	});

	async function itemList(companyId, projectId, environmentId, skipAutoSelect = false) {
		return getAllItemList(companyId, projectId, environmentId).then(responseItems => {
			if (responseItems.status === 1) {
				const $selectItems = $('#select-log-item');
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

				if (!skipAutoSelect) {
					$selectItems.val('all').trigger('change');
				}
				return true;
			}
			throw new Error("Item fetch failed");
		});
	}

	async function restoreFilterFromCookie() {
		const condition = getCookieJSON('logsCondition');
		if (!condition) return;

		isRestoringFromCookie = true;

		try {
			await waitForOption($('#select-log-company'), condition.company);

			if (condition.company === 'all') {
				await projectListForAll(true);
			} else {
				await projectListForCompany(condition.company, true);
			}
			await waitForOption($('#select-log-project'), condition.project);

			if (condition.project === 'all') {
				await environmentListForAll(condition.company, true);
			} else {
				await environmentListForProject(condition.company, condition.project, true);
			}
			await waitForOption($('#select-log-environment'), condition.environment);

			await itemList(condition.company, condition.project, condition.environment, true,);
			await waitForOption($('#select-log-item'), condition.itemName);

			if (condition.descr) $('#log-description').val(condition.descr);
			if (condition.httpStatus) $('#log-httpstatus').val(condition.httpStatus);
			if (condition.path) $('#log-path').val(condition.path);
			if (condition.uniqueId) $('#log-uniqueId').val(condition.uniqueId);
			await waitForOption($('#select-log-trigger-status'), condition.logtriggerstatus);
			await waitForOption($('#select-log-reviewed'), "");

			// --- TIME RANGE ---
			if (condition.time && timeOptions[condition.time]) {
				// If preset label exists, recalc relative to NOW
				const now = new Date();
				const minutes = timeOptions[condition.time];
				viewFromDate = new Date(now.getTime() - minutes * 60000).toISOString();
				viewToDate = now.toISOString();
			} else if (condition.viewFromDate && condition.viewToDate) {
				// fallback: use fixed dates
				viewFromDate = condition.viewFromDate;
				viewToDate = condition.viewToDate;
			}

			const startMoment = moment(viewFromDate);
			const endMoment = moment(viewToDate);
			const drp = $('#reportrange').data('daterangepicker');

			// Remove previous active class
			$('.ranges li').removeClass('active');

			function areMomentsClose(m1, m2, toleranceMinutes = 1) {
				return Math.abs(m1.diff(m2, 'minutes')) <= toleranceMinutes;
			}

			// --- MATCH PRESET LABEL ---
			let matchedLabel = null;
			const ranges = drp.ranges || {};

			for (const [label, range] of Object.entries(ranges)) {
				const presetStart = range[0];
				const presetEnd = range[1];

				if (areMomentsClose(startMoment, presetStart) && areMomentsClose(endMoment, presetEnd)) {
					matchedLabel = label;
					break;
				}
			}

			// Apply start/end dates
			drp.setStartDate(startMoment);
			drp.setEndDate(endMoment);

			// Update UI
			if (matchedLabel) {
				$('#reportrange span').html(matchedLabel);
				$('.since-time').text(matchedLabel);

				$('.ranges li').each(function () {
					if ($(this).text().trim() === matchedLabel) {
						$(this).addClass('active');
					}
				});
			} else {
				const formattedRange = `${startMoment.format('MMMM D, YYYY HH:mm:ss')} - ${endMoment.format('MMMM D, YYYY HH:mm:ss')}`;
				$('#reportrange span').html(formattedRange);
				$('.since-time').text('');
			}

			const companyId = $('#select-log-company').val();
			const projectId = $('#select-log-project').val();
			const environmentId = $('#select-log-environment').val();
			const itemId = $('#select-log-item').val();
			const logDescription = $('#log-description').val();
			const loghttpstatus = $('#log-httpstatus').val();
			let logtriggerstatus = $('#select-log-trigger-status').val();
			const logUniqueId = $('#log-uniqueId').val();
			const logPath = $('#log-path').val();
			const reviewed_status = $('#select-log-reviewed').val();

			getdata(parseInt(perPage), parseInt(currentPage), companyId, projectId, environmentId, itemId, logDescription, loghttpstatus, viewFromDate, viewToDate, logtriggerstatus, logUniqueId, logPath, reviewed_status);
		} catch (err) {
			console.error('Error restoring filters and fetching data:', err);
		} finally {
			isRestoringFromCookie = false;
		}
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

	let companyId = $('#select-log-company').val();
	let projectId = $('#select-log-project').val();
	let environmentId = $('#select-log-environment').val();
	let itemId = $('#select-log-item').val();
	let logDescription = $('#log-description').val();
	let loghttpstatus = $('#log-httpstatus').val();
	let logtriggerstatus = $('#select-log-trigger-status').val();
	let logUniqueId = $('#log-uniqueId').val();
	let logPath = $('#log-path').val();
	let reviewed_status = $('#select-log-reviewed').val();

	if (isRestoringFromCookie) {
		getdata(parseInt(perPage), parseInt(currentPage), companyId, projectId, environmentId, itemId, logDescription, loghttpstatus, viewFromDate,
			viewToDate, logtriggerstatus, logUniqueId, logPath, reviewed_status);
	}

	$('body').on('click', '#search-button', function () {
		let companyId = $('#select-log-company').val();
		let projectId = $('#select-log-project').val();
		let environmentId = $('#select-log-environment').val();
		let itemId = $('#select-log-item').val();
		let logDescription = $('#log-description').val();
		let loghttpstatus = $('#log-httpstatus').val();
		let logtriggerstatus = $('#select-log-trigger-status').val();
		let logUniqueId = $('#log-uniqueId').val();
		let logPath = $('#log-path').val();
		let reviewed_status = $('#select-log-reviewed').val();

		const drp = $('#reportrange').data('daterangepicker');
		let startMoment = drp.startDate;
		let endMoment = drp.endDate;

		// Check if the current range matches a preset
		function areMomentsClose(m1, m2, toleranceMinutes = 1) {
			return Math.abs(m1.diff(m2, 'minutes')) <= toleranceMinutes;
		}

		let timeLabel = '';
		for (const [label, range] of Object.entries(drp.ranges)) {
			if (areMomentsClose(startMoment, range[0]) && areMomentsClose(endMoment, range[1])) {
				timeLabel = label;
				break;
			}
		}

		// If no preset matched, mark as custom
		if (!timeLabel) {
			timeLabel = 'Custom Range';
		} else {
			const minutes = timeOptions[timeLabel];
			if (minutes) {
				startMoment = moment().subtract(minutes, 'minutes').startOf('second');
				endMoment = moment().startOf('second');
			}
		}

		// Update global viewFromDate/viewToDate
		viewFromDate = startMoment.toISOString();
		viewToDate = endMoment.toISOString();

		let dashboardSelectedItem = '';

		if (itemId && itemId !== 'all') {
			dashboardSelectedItem = itemId;

			const itemDetails = itemOptionsGlobalList.find(item => item._id === itemId);

			if (itemDetails) {
				if (itemDetails.companyId)
					setCookie('selectedCompany', itemDetails.companyId);

				if (itemDetails.ProjectId) {
					setCookie('selectedProject', itemDetails.ProjectId);

					const projectDetails = projectOptionsGloabalList.find(
						project => project._id === itemDetails.ProjectId
					);
					if (projectDetails?.name)
						setCookie('selectedProjectName', projectDetails.name);
				}
			}

			setCookie('dashboardSelectedItem', dashboardSelectedItem);
		}

		const queryObj = {
			company: companyId,
			project: projectId,
			environment: environmentId,
			itemName: itemId,
			descr: logDescription,
			httpStatus: loghttpstatus,
			logtriggerstatus: logtriggerstatus,
			time: timeLabel.trim(),
			uniqueId: logUniqueId,
			path: logPath,
			viewFromDate: viewFromDate,
			viewToDate: viewToDate,
			reviewed: reviewed_status
		};

		setCookie('logsCondition', JSON.stringify(queryObj));

		const query_result = {
			company: queryObj.company,
			project: queryObj.project,
			environment: queryObj.environment,
			item: queryObj.itemName,
			descr: queryObj.descr,
			httpStatus: queryObj.httpStatus,
			logtriggerstatus: queryObj.logtriggerstatus,
			uniqueId: queryObj.uniqueId,
			path: queryObj.path,
			viewFromDate: viewFromDate,
			viewToDate: viewToDate,
			reviewed: reviewed_status,
			time: timeLabel,
			dashboardSelectedItem
		};

		currentPage = 1;

		const apiUrl = '/logs/recent-search/save';
		const method = 'POST';

		$.ajax({
			url: apiUrl,
			method: method,
			contentType: 'application/json',
			data: JSON.stringify(query_result),
			success: function (response) {
				if (response.status === 1) {
					getMyFavouriteList(fcurrentPage, fperPage);
					getRecentHistoryList(qcurrentPage, qperPage);
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

		getdata(parseInt(perPage), parseInt(currentPage), companyId, projectId, environmentId, itemId, logDescription, loghttpstatus, viewFromDate,
			viewToDate, logtriggerstatus, logUniqueId, logPath, reviewed_status);
	});

	$('body').on('click', '#add-to-favourite', function () {
		resetAddToFavouriteForm();
		$('#create-add-to-favourite').text("Add Favourite");
		$('#add-to-favourite-modal-label').text("Add Favourite");
		$('#add-to-favourite-create-modal-slide-in').modal('show');
	});

	$('body').on('click', '#my-reviewed', function () {
		$('#reviewed-save-value').val("");
		$('#reviewed-save-modal-slide-in').modal('show');
	});

	$('body').on('click', '#my-favourites', async function () {
		await getMyFavouriteList(fcurrentPage, fperPage);
		await getRecentHistoryList(qcurrentPage, qperPage);
		var firstTabEl = document.querySelector('#myTab li:last-child a');
		if (firstTabEl) {
			var firstTab = new bootstrap.Tab(firstTabEl);
			firstTab.show();
		}
		$('#my-favourite-modal-slide-in').modal('show');
	});

	reviewedTable = $('#reviewed-list-table').DataTable({
		aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
		iDisplayLength: rPerPage,
		pagingType: 'full_numbers',
		searching: false,
		ordering: false
	});

	$('body').on('click', '#reviewed-list-table_paginate .paginate_button', function () {
		const pageNo = parseInt($(this).data('pageno'));
		if (!pageNo || pageNo === parseInt(rcurrentPage)) return;
		rcurrentPage = pageNo;
		reviewedTable.clear();
		reviewedTable.destroy();
		$('#reviewed-list-table tbody').empty();
		reviewedTable = $('#reviewed-list-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: rPerPage,
			pagingType: 'full_numbers',
			searching: false,
			ordering: false
		});
		getReviewedByUniqueId(rcurrentPage, rPerPage);
	});


	$('body').on('change', '#reviewed-list-table_length select', function () {
		rPerPage = parseInt($(this).val());
		rcurrentPage = 1;
		reviewedTable.clear();
		reviewedTable.destroy();
		reviewedTable = $('#reviewed-list-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: rPerPage,
			pagingType: 'full_numbers',
			searching: false,
			ordering: false
		});
		getReviewedByUniqueId(rcurrentPage, rPerPage);
	});

	async function getReviewedByUniqueId(page = 1, limit = 10) {
		$.ajax({
			url: `/logs/review/${reviwedUniqueId}?page=${page}&limit=${limit}`,
			method: 'GET',
			success: function (response) {
				let counter = ((parseInt(page) - 1) * parseInt(limit)) + 1;
				let totalRecord = parseInt(response.total);
				if (response.data.length <= 0) {
					$('#reviewed-list-table tbody').html('<tr class="odd"><td valign="top" colspan="2" class="dataTables_empty">No data available in table</td></tr>');
				}

				reviewedTable.clear();

				$.each(response.data, function (index, data) {
					const formatted = moment(data.createdAt).format("YYYY-MM-DD HH:mm:ss.SSS");

					let reviewedDescriptionText = data.datas || '';
					try {
						const parsed = JSON.parse(reviewedDescriptionText);
						reviewedDescriptionText = `<pre style="display:block; font-size:90%; color:#2A2E30; margin-top:0; margin-bottom:1rem; overflow:auto; -ms-overflow-style:scrollbar; background:none; background-color: transparent !important">${JSON.stringify(parsed, null, 4)}</pre>`;
					} catch (e) {
						reviewedDescriptionText = reviewedDescriptionText.replace(/\n/g, '<br>');
					}

					const safeReviewedDescription = reviewedDescriptionText.includes("<pre>")
						? reviewedDescriptionText
						: reviewedDescriptionText
							.replace(/"/g, '&quot;')
							.replace(/'/g, '&#39;');

					reviewedTable.row.add([
						counter++,
						formatted,
						safeReviewedDescription
					]);
				});

				reviewedTable.draw();

				$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
				let startEntry = (parseInt(page) == 1) ? 1 : ((parseInt(limit) * (parseInt(page) - 1)) + 1);
				let endEntry = (parseInt(page) == 1) ? parseInt(limit) : (parseInt(limit) * parseInt(page));
				endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

				if (totalRecord == 0) {
					startEntry = 0;
				}

				let showpage = 'Showing ' + startEntry + ' to ' + endEntry + ' of ' + totalRecord + ' entries';
				$('body').find('#reviewed-list-table_info').html(showpage);

				let dataDtIdx = 0;
				let paginationHtml = '';
				let firstDisable = (parseInt(page) == 1) ? 'disabled' : '';
				let lastDisable = (parseInt(page) == Math.ceil(totalRecord / parseInt(limit))) ? 'disabled' : '';

				if (Math.ceil(totalRecord / parseInt(limit)) > 0) {
					paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="reviewed-list-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="reviewed-list-table_first_1" data-pageno="1">First</a>';
					dataDtIdx++;
					paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="reviewed-list-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="reviewed-list-table_previous_1" data-pageno="' + (parseInt(page) - 1) + '">Previous</a>';
					paginationHtml += '<span>';
					dataDtIdx++;

					if (parseInt(page) > 2) {
						paginationHtml += '<a class="paginate_button" aria-controls="reviewed-list-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
						if (parseInt(page) > 3) {
							paginationHtml += '<span class="ellipsis">...</span>';
						}
						dataDtIdx++;
					}

					if ((parseInt(page) - 1) > 0) {
						paginationHtml += '<a class="paginate_button" aria-controls="reviewed-list-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(page) - 1) + '">' + (parseInt(page) - 1) + '</a>';
						dataDtIdx++;
					}

					paginationHtml += '<a class="paginate_button current" aria-controls="reviewed-list-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(page) + '">' + parseInt(page) + '</a>';
					dataDtIdx++;

					if ((parseInt(page) + 1) < Math.ceil(totalRecord / parseInt(limit)) + 1) {
						paginationHtml += '<a class="paginate_button" aria-controls="reviewed-list-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(page) + 1) + '">' + (parseInt(page) + 1) + '</a>';
						dataDtIdx++;
					}

					if (parseInt(page) < Math.ceil(totalRecord / parseInt(limit)) - 1) {
						if (((parseInt(page) + 3) < Math.ceil(totalRecord / parseInt(limit)) + 1)) {
							paginationHtml += '<span class="ellipsis">...</span>';
						}
						paginationHtml += '<a class="paginate_button" aria-controls="reviewed-list-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(limit)) + '">' + Math.ceil(totalRecord / parseInt(limit)) + '</a>';
						dataDtIdx++;
					}

					paginationHtml += '</span>';
					paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="reviewed-list-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="reviewed-list-table_next_1" data-pageno="' + (parseInt(page) + 1) + '">Next</a>';
					dataDtIdx++;
					paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="reviewed-list-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="reviewed-list-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(limit)) + '">Last</a>';
				}

				$('body').find('#reviewed-list-table_paginate').html(paginationHtml);
			},
			error: function (xhr) {
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

	fTable = $('#favourites-data-table').DataTable({
		aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
		iDisplayLength: fperPage,
		pagingType: 'full_numbers',
		searching: false,
		ordering: false
	});

	qTable = $('#query-data-table').DataTable({
		aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
		iDisplayLength: qperPage,
		pagingType: 'full_numbers',
		searching: false,
		ordering: false
	});

	$('body').on('click', '#favourites-data-table_paginate .paginate_button', function () {
		const pageNo = parseInt($(this).data('pageno'));
		if (!pageNo || pageNo === parseInt(fcurrentPage)) return;
		fcurrentPage = pageNo;
		fTable.clear();
		fTable.destroy();
		$('#favourites-data-table tbody').empty();
		fTable = $('#favourites-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: fperPage,
			pagingType: 'full_numbers',
			searching: false,
			ordering: false
		});
		getMyFavouriteList(fcurrentPage, fperPage)
	});

	$('body').on('change', '#favourites-data-table_length select', function () {
		fperPage = parseInt($(this).val());
		fcurrentPage = 1;
		fTable.clear();
		fTable.destroy();
		fTable = $('#favourites-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: fperPage,
			pagingType: 'full_numbers',
			searching: false,
			ordering: false
		});
		getMyFavouriteList(fcurrentPage, fperPage)
	});

	$('body').on('click', '#query-data-table_paginate .paginate_button', function () {
		const pageNo = parseInt($(this).data('pageno'));
		if (!pageNo || pageNo === parseInt(qcurrentPage)) return;
		qcurrentPage = pageNo;
		qTable.clear();
		qTable.destroy();
		$('#query-data-table tbody').empty();
		qTable = $('#query-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: qperPage,
			pagingType: 'full_numbers',
			searching: false,
			ordering: false
		});
		getRecentHistoryList(qcurrentPage, qperPage)
	});

	$('body').on('change', '#query-data-table_length select', function () {
		qperPage = parseInt($(this).val());
		qcurrentPage = 1;
		qTable.clear();
		qTable.destroy();
		qTable = $('#query-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: qperPage,
			pagingType: 'full_numbers',
			searching: false,
			ordering: false
		});
		getRecentHistoryList(qcurrentPage, qperPage)
	});

	async function getMyFavouriteList(page = 1, limit = 10) {
		$.ajax({
			url: `/logs/favourite?page=${page}&limit=${limit}`,
			method: 'GET',
			success: function (response) {
				let counter = ((parseInt(page) - 1) * parseInt(limit)) + 1;
				let totalRecord = parseInt(response.total);
				if (response.data.length <= 0) {
					$('#favourites-data-table tbody').html('<tr class="odd"><td valign="top" colspan="3" class="dataTables_empty">No data available in table</td></tr>');
				}

				fTable.clear();

				$.each(response.data, function (index, data) {

					let $buttonGroup = '<div class="btn-group" role="group" aria-label="Actions">';

					$buttonGroup += '<button type="button" class="btn btn-outline-secondary favourite-edit-model" data-toggle="tooltip" title="Edit" data-id="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>';

					$buttonGroup += '<button type="button" class="btn btn-outline-secondary favourite-delete" data-toggle="tooltip" title="Delete" data-id="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg></button>';

					$buttonGroup += '<button type="button" class="btn btn-outline-secondary query-search" data-toggle="tooltip" title="Search" data-id="' + data?.log_query_details?._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></button>'

					$buttonGroup += '</div>';

					fTable.row.add([
						counter++,
						data.name,
						data.description,
						$buttonGroup
					]);
				});

				fTable.draw();

				$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
				let startEntry = (parseInt(page) == 1) ? 1 : ((parseInt(limit) * (parseInt(page) - 1)) + 1);
				let endEntry = (parseInt(page) == 1) ? parseInt(limit) : (parseInt(limit) * parseInt(page));
				endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

				if (totalRecord == 0) {
					startEntry = 0;
				}

				let showpage = 'Showing ' + startEntry + ' to ' + endEntry + ' of ' + totalRecord + ' entries';
				$('body').find('#favourites-data-table_info').html(showpage);

				let dataDtIdx = 0;
				let paginationHtml = '';
				let firstDisable = (parseInt(page) == 1) ? 'disabled' : '';
				let lastDisable = (parseInt(page) == Math.ceil(totalRecord / parseInt(limit))) ? 'disabled' : '';

				if (Math.ceil(totalRecord / parseInt(limit)) > 0) {
					paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="favourites-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="favourites-data-table_first_1" data-pageno="1">First</a>';
					dataDtIdx++;
					paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="favourites-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="favourites-data-table_previous_1" data-pageno="' + (parseInt(page) - 1) + '">Previous</a>';
					paginationHtml += '<span>';
					dataDtIdx++;

					if (parseInt(page) > 2) {
						paginationHtml += '<a class="paginate_button" aria-controls="favourites-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
						if (parseInt(page) > 3) {
							paginationHtml += '<span class="ellipsis">...</span>';
						}
						dataDtIdx++;
					}

					if ((parseInt(page) - 1) > 0) {
						paginationHtml += '<a class="paginate_button" aria-controls="favourites-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(page) - 1) + '">' + (parseInt(page) - 1) + '</a>';
						dataDtIdx++;
					}

					paginationHtml += '<a class="paginate_button current" aria-controls="favourites-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(page) + '">' + parseInt(page) + '</a>';
					dataDtIdx++;

					if ((parseInt(page) + 1) < Math.ceil(totalRecord / parseInt(limit)) + 1) {
						paginationHtml += '<a class="paginate_button" aria-controls="favourites-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(page) + 1) + '">' + (parseInt(page) + 1) + '</a>';
						dataDtIdx++;
					}

					if (parseInt(page) < Math.ceil(totalRecord / parseInt(limit)) - 1) {
						if (((parseInt(page) + 3) < Math.ceil(totalRecord / parseInt(limit)) + 1)) {
							paginationHtml += '<span class="ellipsis">...</span>';
						}
						paginationHtml += '<a class="paginate_button" aria-controls="favourites-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(limit)) + '">' + Math.ceil(totalRecord / parseInt(limit)) + '</a>';
						dataDtIdx++;
					}

					paginationHtml += '</span>';
					paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="favourites-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="favourites-data-table_next_1" data-pageno="' + (parseInt(page) + 1) + '">Next</a>';
					dataDtIdx++;
					paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="favourites-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="favourites-data-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(limit)) + '">Last</a>';
				}

				$('body').find('#favourites-data-table_paginate').html(paginationHtml);
			},
			error: function (xhr) {
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

	$('body').on('click', '.favourite-edit-model', function () {
		const id = $(this).data('id');

		// clear old form values
		$('#form-add-to-favourite-create')[0].reset();

		$.ajax({
			url: '/logs/favourite/' + id,
			method: 'GET',
			success: function (response) {
				if (response.status === 1) {
					const fav = response.data;

					// bind values
					$('#add-to-favourite-id').val(fav._id);
					$('#add-to-favourite-name').val(fav.name);
					$('#add-to-favourite-sequence').val(fav.sequence);
					$('#add-to-favourite-description').val(fav.description);
					$('#create-add-to-favourite').text("Update Favourite");
					$('#add-to-favourite-modal-label').text("Update Favourite")

					if (fav.isActive) {
						$('#is-add-to-favourite-active').prop('checked', true);
					} else {
						$('#is-add-to-favourite-active').prop('checked', false);
					}

					// show modal
					$('#add-to-favourite-create-modal-slide-in').modal('show');
				} else {
					Swal.fire("Error!", response.message, "error");
				}
			},
			error: function (xhr) {
				Swal.fire("Error!", xhr?.responseJSON?.message || "Something went wrong!", "error");
			}
		});
	});

	$('body').on('click', '.query-search', async function () {
		const id = $(this).data('id');

		try {
			const response = await $.ajax({
				url: '/logs/log-queries/' + id,
				method: 'GET'
			});

			if (response.status !== 1) {
				return Swal.fire("Error!", response.message, "error");
			}

			const query = response.data;

			let company = query.company === "ALL" ? "all" : query.company;
			let project = query.project === "ALL" ? "all" : query.project;
			let environment = query.environment === "ALL" ? "all" : query.environment;
			let item = query.item === "ALL" ? "all" : query.item;

			const queryObj = {
				company: company,
				project: project,
				environment: environment,
				itemName: item,
				descr: query.descr,
				httpStatus: query.httpStatus,
				logtriggerstatus: query.logtriggerstatus,
				time: query.time,
				uniqueId: query.uniqueId,
				path: query.path,
				viewFromDate: query.fromDate,
				viewToDate: query.toDate,
			};

			await waitForOption($('#select-log-company'), company);

			if (company === 'all') {
				await projectListForAll(true);
			} else {
				await projectListForCompany(company, true);
			}
			await waitForOption($('#select-log-project'), project);

			if (project === 'all') {
				await environmentListForAll(company);
			} else {
				await environmentListForProject(company, project);
			}
			await waitForOption($('#select-log-environment'), environment);

			await itemList(company, project, environment);
			await waitForOption($('#select-log-item'), item);

			$('#log-description').val(query.descr);
			$('#log-httpstatus').val(query.httpStatus);
			$('#log-path').val(query.path);
			$('#log-uniqueId').val(query.uniqueId);
			await waitForOption($('#select-log-trigger-status'), query.logtriggerstatus);
			await waitForOption($('#select-log-reviewed'), "");

			if (query.time && timeOptions[query.time]) {
				const now = new Date();
				const minutes = timeOptions[query.time];
				viewFromDate = new Date(now.getTime() - minutes * 60000).toISOString();
				viewToDate = now.toISOString();
			} else if (query.viewFromDate && query.viewToDate) {
				viewFromDate = query.viewFromDate;
				viewToDate = query.viewToDate;
			}

			const startMoment = moment(viewFromDate);
			const endMoment = moment(viewToDate);
			const drp = $('#reportrange').data('daterangepicker');

			drp.setStartDate(startMoment);
			drp.setEndDate(endMoment);
			$('.ranges li').removeClass('active');

			// Check for preset match
			function areMomentsClose(m1, m2, toleranceMinutes = 1) {
				return Math.abs(m1.diff(m2, 'minutes')) <= toleranceMinutes;
			}

			let matchedLabel = null;
			const ranges = drp.ranges || {};

			for (const [label, range] of Object.entries(ranges)) {
				if (areMomentsClose(startMoment, range[0]) && areMomentsClose(endMoment, range[1])) {
					matchedLabel = label;
					break;
				}
			}

			// Update UI
			if (matchedLabel) {
				$('#reportrange span').html(matchedLabel);
				$('.since-time').text(matchedLabel);

				$('.ranges li').each(function () {
					if ($(this).text().trim() === matchedLabel) {
						$(this).addClass('active');
					}
				});
			} else {
				const formattedRange = `${startMoment.format('MMMM D, YYYY HH:mm:ss')} - ${endMoment.format('MMMM D, YYYY HH:mm:ss')}`;
				$('#reportrange span').html(formattedRange);
				$('.since-time').text('');
			}

			setCookie('logsCondition', JSON.stringify(queryObj));

			currentPage = 1;
			getdata(parseInt(perPage), parseInt(currentPage), company, project, environment, item, query.descr, query.httpStatus, viewFromDate, viewToDate, query.logtriggerstatus, query.uniqueId, query.path, query.reviewed);

			location.reload();

		} catch (err) {
			console.error(err);
			Swal.fire("Error!", err?.responseJSON?.message || "Something went wrong!", "error");
		}
	});

	$('body').on('click', '.recent-search', async function () {
		const id = $(this).data('id');

		try {
			const response = await $.ajax({
				url: '/logs/recent-search/' + id,
				method: 'GET'
			});

			if (response.status !== 1) {
				return Swal.fire("Error!", response.message, "error");
			}

			const query = response.data;

			let company = query.company === "ALL" ? "all" : query.company;
			let project = query.project === "ALL" ? "all" : query.project;
			let environment = query.environment === "ALL" ? "all" : query.environment;
			let item = query.item === "ALL" ? "all" : query.item;

			const queryObj = {
				company: company,
				project: project,
				environment: environment,
				itemName: item,
				descr: query.descr,
				httpStatus: query.httpStatus,
				logtriggerstatus: query.logtriggerstatus,
				time: query.time,
				uniqueId: query.uniqueId,
				path: query.path,
				viewFromDate: query.fromDate,
				viewToDate: query.toDate,
			};

			await waitForOption($('#select-log-company'), company);

			if (company === 'all') {
				await projectListForAll(true);
			} else {
				await projectListForCompany(company, true);
			}
			await waitForOption($('#select-log-project'), project);

			if (project === 'all') {
				await environmentListForAll(company);
			} else {
				await environmentListForProject(company, project);
			}
			await waitForOption($('#select-log-environment'), environment);

			await itemList(company, project, environment);
			await waitForOption($('#select-log-item'), item);

			$('#log-description').val(query.descr);
			$('#log-httpstatus').val(query.httpStatus);
			$('#log-path').val(query.path);
			$('#log-uniqueId').val(query.uniqueId);
			await waitForOption($('#select-log-trigger-status'), query.logtriggerstatus);
			await waitForOption($('#select-log-reviewed'), "");

			if (query.time && timeOptions[query.time]) {
				const now = new Date();
				const minutes = timeOptions[query.time];
				viewFromDate = new Date(now.getTime() - minutes * 60000).toISOString();
				viewToDate = now.toISOString();
			} else if (query.viewFromDate && query.viewToDate) {
				viewFromDate = query.viewFromDate;
				viewToDate = query.viewToDate;
			}

			const startMoment = moment(viewFromDate);
			const endMoment = moment(viewToDate);
			const drp = $('#reportrange').data('daterangepicker');

			drp.setStartDate(startMoment);
			drp.setEndDate(endMoment);
			$('.ranges li').removeClass('active');

			// Check for preset match
			function areMomentsClose(m1, m2, toleranceMinutes = 1) {
				return Math.abs(m1.diff(m2, 'minutes')) <= toleranceMinutes;
			}

			let matchedLabel = null;
			const ranges = drp.ranges || {};

			for (const [label, range] of Object.entries(ranges)) {
				if (areMomentsClose(startMoment, range[0]) && areMomentsClose(endMoment, range[1])) {
					matchedLabel = label;
					break;
				}
			}

			if (matchedLabel) {
				$('#reportrange span').html(matchedLabel);
				$('.since-time').text(matchedLabel);
				$('.ranges li').each(function () {
					if ($(this).text().trim() === matchedLabel) $(this).addClass('active');
				});
			} else {
				const formattedRange = `${startMoment.format('MMMM D, YYYY HH:mm:ss')} - ${endMoment.format('MMMM D, YYYY HH:mm:ss')}`;
				$('#reportrange span').html(formattedRange);
				$('.since-time').text('');
			}

			setCookie('logsCondition', JSON.stringify(queryObj));

			currentPage = 1;
			getdata(parseInt(perPage), parseInt(currentPage), company, project, environment, item, query.descr, query.httpStatus, viewFromDate, viewToDate, query.logtriggerstatus, query.uniqueId, query.path, query.reviewed);

			location.reload();

		} catch (err) {
			console.error(err);
			Swal.fire("Error!", err?.responseJSON?.message || "Something went wrong!", "error");
		}
	});

	$('body').on('click', '.favourite-delete', function () {
		const id = $(this).data('id');

		Swal.fire({
			title: 'Are you sure?',
			text: 'Do you want to delete this favourite?',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'Yes, delete it',
			cancelButtonText: 'Cancel',
			customClass: {
				confirmButton: 'btn btn-danger',
				cancelButton: 'btn btn-outline-secondary ml-1'
			},
			buttonsStyling: false
		}).then(function (result) {
			if (result.isConfirmed) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({ display: 'block' });

				$.ajax({
					url: '/logs/favourite/' + id,
					method: 'DELETE',
					success: function (response) {
						Swal.fire({
							title: response.status == 1 ? 'Deleted!' : 'Error!',
							text: response.message,
							icon: response.status == 1 ? 'success' : 'error',
							customClass: { confirmButton: 'btn btn-primary' },
							buttonsStyling: false,
							timer: 1500
						});

						if (response.status == 1) {
							getMyFavouriteList(fcurrentPage, fperPage);
							getRecentHistoryList(qcurrentPage, qperPage);
						}

						$('.overlay, body').addClass('loaded');
						$('.overlay').css({ display: 'none' });
					}
				});
			}
		});
	});

	async function getRecentHistoryList(page = 1, limit = 10) {
		$.ajax({
			url: `/logs/recent-search?page=${page}&limit=${limit}`,
			method: 'GET',
			success: function (response) {
				let counter = ((parseInt(page) - 1) * parseInt(limit)) + 1;
				let totalRecord = parseInt(response.total);
				if (response.data.length <= 0) {
					$('#query-data-table tbody').html('<tr class="odd"><td valign="top" colspan="15" class="dataTables_empty">No data available in table</td></tr>');
				}

				qTable.clear();

				$.each(response.data, function (index, data) {

					let $buttonGroup = '<div class="btn-group" role="group" aria-label="Actions">';
					$buttonGroup += '<button type="button" class="btn btn-outline-secondary recent-search" data-toggle="tooltip" title="Search" data-id="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></button>'
					$buttonGroup += '</div>';

					let time = data.time;
					let startDate = data.fromDate;
					let endDate = data.toDate;

					qTable.row.add([
						counter++,
						data.company_name,
						data.project_name,
						data.environment_name,
						data.item_name,
						data.descr,
						data.httpStatus,
						data.logtriggerstatus === "triggered" ? 'Yes' : (data.logtriggerstatus === "not_triggered" ? 'No' : data.logtriggerstatus),
						data.uniqueId,
						data.path,
						time,
						startDate,
						endDate,
						$buttonGroup
					]);
				});

				qTable.draw();

				$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
				let startEntry = (parseInt(page) == 1) ? 1 : ((parseInt(limit) * (parseInt(page) - 1)) + 1);
				let endEntry = (parseInt(page) == 1) ? parseInt(limit) : (parseInt(limit) * parseInt(page));
				endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

				if (totalRecord == 0) {
					startEntry = 0;
				}

				let showpage = 'Showing ' + startEntry + ' to ' + endEntry + ' of ' + totalRecord + ' entries';
				$('body').find('#query-data-table_info').html(showpage);

				let dataDtIdx = 0;
				let paginationHtml = '';
				let firstDisable = (parseInt(page) == 1) ? 'disabled' : '';
				let lastDisable = (parseInt(page) == Math.ceil(totalRecord / parseInt(limit))) ? 'disabled' : '';

				if (Math.ceil(totalRecord / parseInt(limit)) > 0) {
					paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="query-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="query-data-table_first_1" data-pageno="1">First</a>';
					dataDtIdx++;
					paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="query-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="query-data-table_previous_1" data-pageno="' + (parseInt(page) - 1) + '">Previous</a>';
					paginationHtml += '<span>';
					dataDtIdx++;

					if (parseInt(page) > 2) {
						paginationHtml += '<a class="paginate_button" aria-controls="query-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
						if (parseInt(page) > 3) {
							paginationHtml += '<span class="ellipsis">...</span>';
						}
						dataDtIdx++;
					}

					if ((parseInt(page) - 1) > 0) {
						paginationHtml += '<a class="paginate_button" aria-controls="query-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(page) - 1) + '">' + (parseInt(page) - 1) + '</a>';
						dataDtIdx++;
					}

					paginationHtml += '<a class="paginate_button current" aria-controls="query-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(page) + '">' + parseInt(page) + '</a>';
					dataDtIdx++;

					if ((parseInt(page) + 1) < Math.ceil(totalRecord / parseInt(limit)) + 1) {
						paginationHtml += '<a class="paginate_button" aria-controls="query-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(page) + 1) + '">' + (parseInt(page) + 1) + '</a>';
						dataDtIdx++;
					}

					if (parseInt(page) < Math.ceil(totalRecord / parseInt(limit)) - 1) {
						if (((parseInt(page) + 3) < Math.ceil(totalRecord / parseInt(limit)) + 1)) {
							paginationHtml += '<span class="ellipsis">...</span>';
						}
						paginationHtml += '<a class="paginate_button" aria-controls="query-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(limit)) + '">' + Math.ceil(totalRecord / parseInt(limit)) + '</a>';
						dataDtIdx++;
					}

					paginationHtml += '</span>';
					paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="query-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="query-data-table_next_1" data-pageno="' + (parseInt(page) + 1) + '">Next</a>';
					dataDtIdx++;
					paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="query-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="query-data-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(limit)) + '">Last</a>';
				}

				$('body').find('#query-data-table_paginate').html(paginationHtml);
			},
			error: function (xhr) {
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

	function resetAddToFavouriteForm() {
		$('#form-add-to-favourite-create')[0].reset();
		$('#form-add-to-favourite-create').find('.help-block').remove();
		$('#form-add-to-favourite-create').find('.error').removeClass('error');
		$('#add-to-favourite-id').val('');
		$('#is-add-to-favourite-active').prop('checked', true);
	}

	if ($('#form-add-to-favourite-create').length) {
		formValidator = $('#form-add-to-favourite-create').validate({
			rules: {
				'add-to-favourite-name': {
					required: true
				},
				'add-to-favourite-sequence': {
					digits: true
				}
			},
			messages: {
				'add-to-favourite-name': {
					required: 'Please enter the favourite Name!'
				},
				'add-to-favourite-sequence': {
					digits: 'Only numeric digits are allowed!'
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
			$('#form-add-to-favourite-create').find('button[type="submit"]').prop('disabled', true);
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({ 'display': 'block' });

			const timeLabel = $('.since-time').text();
			let time = '';

			if (timeLabel.includes('Since')) {
				time = timeLabel.replace('Since ', '').replace(' ago', '');
			} else {
				time = timeLabel; // in case of custom range
			}

			const query_result = {
				company: $('#select-log-company').val(),
				project: $('#select-log-project').val(),
				environment: $('#select-log-environment').val(),
				item: $('#select-log-item').val(),
				descr: $('#log-description').val(),
				httpStatus: $('#log-httpstatus').val(),
				logtriggerstatus: $('#select-log-trigger-status').val(),
				uniqueId: $('#log-uniqueId').val(),
				path: $('#log-path').val(),
				viewFromDate: viewFromDate,
				viewToDate: viewToDate,
				time: time
			};

			const data = {
				favouriteName: $('#add-to-favourite-name').val(),
				sequence: $('#add-to-favourite-sequence').val(),
				favouriteDescription: $('#add-to-favourite-description').val(),
				isActive: $('#is-add-to-favourite-active').is(':checked') ? 1 : 0,
				...query_result
			};

			const id = $('#add-to-favourite-id').val();
			const apiUrl = (!id) ? '/logs/favourite/save' : '/logs/favourite/update/' + id;
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
						getMyFavouriteList(fcurrentPage, fperPage);
						getRecentHistoryList(qcurrentPage, qperPage);
						$('#add-to-favourite-create-modal-slide-in').modal('hide');
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
					$('#form-add-to-favourite-create').find('button[type="submit"]').prop('disabled', false);
				},
				error: function (xhr, status, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });
					$('#form-add-to-favourite-create').find('button[type="submit"]').prop('disabled', false);

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
	}

	$('body').on('click', '#logs_data_table_paginate .paginate_button', function () {
		const pageNo = parseInt($(this).data('pageno'));
		if (!pageNo || pageNo === parseInt(currentPage)) return;
		currentPage = pageNo;
		maintable.clear();
		maintable.destroy();
		$('#logs_data_table tbody').empty();
		maintable = $('#logs_data_table').DataTable({
			order: [[10, 'desc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			searching: false,
			aoColumns: [
				null,
				null,
				null,
				null,
				{ 'sClass': 'line-break-anywhare' },
				{ width: "200px" },
				null,
				null,
				null,
				null,
				null,
				null,
				null
			]
		});

		let companyId = $('#select-log-company').val();
		let projectId = $('#select-log-project').val();
		let environmentId = $('#select-log-environment').val();
		let itemId = $('#select-log-item').val();
		let logDescription = $('#log-description').val();
		let loghttpstatus = $('#log-httpstatus').val();
		let logtriggerstatus = $('#select-log-trigger-status').val();
		let logUniqueId = $('#log-uniqueId').val();
		let logPath = $('#log-path').val();
		let reviewed_status = $('#select-log-reviewed').val();

		getdata(parseInt(perPage), parseInt(currentPage), companyId, projectId, environmentId, itemId, logDescription, loghttpstatus, viewFromDate,
			viewToDate, logtriggerstatus, logUniqueId, logPath, reviewed_status);
	});

	$('body').on('change', '#logs_data_table_length select', function () {
		perPage = parseInt($(this).val());
		currentPage = 1;
		maintable.clear();
		maintable.destroy();
		maintable = $('#logs_data_table').DataTable({
			order: [[10, 'desc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			searching: false,
			aoColumns: [
				null,
				null,
				null,
				null,
				{ 'sClass': 'line-break-anywhare' },
				{ width: "200px" },
				null,
				null,
				null,
				null,
				null,
				null,
				null
			]
		});

		let companyId = $('#select-log-company').val();
		let projectId = $('#select-log-project').val();
		let environmentId = $('#select-log-environment').val();
		let itemId = $('#select-log-item').val();
		let logDescription = $('#log-description').val();
		let loghttpstatus = $('#log-httpstatus').val();
		let logtriggerstatus = $('#select-log-trigger-status').val();
		let logUniqueId = $('#log-uniqueId').val();
		let logPath = $('#log-path').val();
		let reviewed_status = $('#select-log-reviewed').val();

		getdata(parseInt(perPage), parseInt(currentPage), companyId, projectId, environmentId, itemId, logDescription, loghttpstatus, viewFromDate,
			viewToDate, logtriggerstatus, logUniqueId, logPath, reviewed_status);
	});

	function getdata(perPage, currentPage, companyId, projectId, environmentId, itemId, logDescription, loghttpstatus, fromDate,
		toDate, logtriggerstatus, logUniqueId, logPath, reviewed) {
		$('#logs_data_table tbody').empty();
		$('#logs_data_table tbody').html('<tr class="odd"><td valign="top" colspan="11" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

		$.ajax({
			url: '/logs/logGroupFullList',
			method: 'post',
			dataType: 'json',
			data: { page: parseInt(currentPage), limit: parseInt(perPage), type: 'log', companyId, projectId, environmentId, itemId, logDescription, loghttpstatus, fromDate, toDate, logtriggerstatus, logUniqueId, logPath, reviewed },
			success: function (response) {
				let counter = ((parseInt(currentPage) - 1) * parseInt(perPage)) + 1;
				let totalRecord = parseInt(response.total);
				totalLogRecords = totalRecord;

				maintable.clear();
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

					// Make ItemName clickable with underline
					const itemName = data?.item_details?.ItemName || '';
					const clickableItemName = itemName ? `<span class="clickable-item-name" data-item-id="${data?.item_id}" data-unique-id="${data.unique_id}" data-type="${data.type}" onclick="openItemModal(this)">${itemName}</span>` : '';

					// const logDescriptionText = (data?.log_description?.datas || '').replace(/\n/g, '<br>');
					const logDescriptionText = (data?.log_description?.datas || '').replace(/\n/g, '<br>');

					const safeLogDescription = logDescriptionText
						.replace(/"/g, '&quot;')
						.replace(/'/g, '&#39;');

					// Apply underline class only if description exists
					const clickableLogDescription = `<span class="${logDescriptionText ? 'clickable-item-name' : ''}" data-item-id="${data?.item_id}" data-unique-id="${data.unique_id}" data-type="${data.type}" data-log-description="${safeLogDescription}" onclick="openLogDescriptionModal(this)">${logDescriptionText}</span>`;

					let isChecked = data.isReviewed ? 'checked' : '';

					let $checkbox = `
						<div class="custom-control custom-checkbox mt-0">
							<input type="checkbox" 
								name="log_uniqueId_${data.unique_id}" 
								id="log_uniqueId_${data.unique_id}" 
								class="custom-control-input reviewed-checkbox" 
								data-unique-id="${data.unique_id}" 
								aria-label="Select Log">
							<label class="custom-control-label" for="log_uniqueId_${data.unique_id}"></label>
						</div>
					`;

					let review_logs = data.review_logs ? true : false;

					let logOptions = '';

					if (review_logs) {
						logOptions = `
						<div class="d-flex align-items-center justify-content-center">
							${$checkbox}
							<button type="button" class="btn btn-outline-secondary btn-sm view-log-eye ml-1" 
								data-toggle="tooltip" title="View Log" 
								data-unique-id="${data.unique_id}" data-type="${data.type}">
								<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" 
									viewBox="0 0 24 24" fill="none" stroke="currentColor" 
									stroke-width="2" stroke-linecap="round" stroke-linejoin="round" 
									class="feather feather-eye">
									<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
									<circle cx="12" cy="12" r="3"></circle>
								</svg>
							</button>
						</div>
					`;
					} else {
						logOptions = `
							<div class="d-flex align-items-center justify-content-center">
								${$checkbox}
							</div>
						`;
					}

					let $button_group = '<div class="btn-group" role="group" aria-label="Basic example">';
					$button_group += '<button type="button" class="btn btn-outline-secondary view-item-logs-modal" data-toggle="tooltip" title="View" data-id="' + data.unique_id + '" data-type="' + data.type + '"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>';
					$button_group += '</div>';

					let httpStatus = data.all_log_httpstatus.length > 0 ? data.all_log_httpstatus[0].httpStatus : '';

					maintable.row.add([
						counter++,
						clickableItemName,
						data.unique_id,
						data.type,
						data.path,
						clickableLogDescription,
						logOptions,
						// (data?.log_description?.datas || "").replace(/\n/g, "<br>") || "",
						data?.last_end_log_history?.description || data?.last_log_history?.description,
						httpStatus || '',
						startTime,
						endTime,
						differenceInMilliseconds,
						$button_group
					]);
				});

				maintable.draw(false);

				$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
				let startEntry = (parseInt(currentPage) == 1) ? 1 : ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1);
				let endEntry = (parseInt(currentPage) == 1) ? parseInt(perPage) : (parseInt(perPage) * parseInt(currentPage));
				endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

				if (totalRecord == 0) {
					startEntry = 0;
				}

				let showpage = 'Showing ' + startEntry + ' to ' + endEntry + ' of ' + totalRecord + ' entries';
				$('body').find('#logs_data_table_info').html(showpage);

				renderPaginationLog(parseInt(currentPage), parseInt(perPage), totalRecord);

			},
			error: function (response) {
				console.log(response);
				alert('server error');
			}
		});

	}

	function renderPaginationLog(currentPage, perPage, totalRecord) {
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

		$('#logs_data_table_paginate').html(paginationHtml);
	}

	$("#logs_data_table").on("click", ".view-log-eye", function () {
		openReviewedComments(this);
	});

	$('#logs_data_table tbody').on('click', 'td:nth-child(6)', function () {
		// find the <span> inside this td
		const $span = $(this).find('span[data-item-id]');
		if ($span.length) {
			openLogDescriptionModal($span[0]); // pass span element to your function
		}
	});

	$('#reviewed_select_all').on('change', function () {
		const isChecked = $(this).is(':checked');
		$('.reviewed-checkbox').not('#reviewed_select_all').prop('checked', isChecked);

		selectedUniqueIds = [];
		if (isChecked) {
			$('.reviewed-checkbox').not('#reviewed_select_all').each(function () {
				selectedUniqueIds.push($(this).data('unique-id'));
			});
		}

		renderPaginationLog(parseInt(currentPage), parseInt(perPage), totalLogRecords);
	});

	$(document).on('change', '.reviewed-checkbox:not(#reviewed_select_all)', function () {
		const $checkboxes = $('.reviewed-checkbox').not('#reviewed_select_all');
		const totalItems = $checkboxes.length;
		const checkedItems = $checkboxes.filter(':checked').length;

		selectedUniqueIds = [];
		$checkboxes.filter(':checked').each(function () {
			selectedUniqueIds.push($(this).data('unique-id'));
		});

		$('#reviewed_select_all').prop('checked', totalItems === checkedItems && totalItems > 0);
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
		oldViewLogData(parseInt(viewLogsPerPage), parseInt(viewLogsCurrentPage), viewLogsItemId);
	});

	$('body').on('change', '#view-logs-data-table_length select', function () {
		viewLogsPerPage = $('#view-logs-data-table_length select').val();
		viewLogsCurrentPage = 1;
		if ($.fn.DataTable.isDataTable('#view-logs-data-table')) {
			$('#view-logs-data-table').DataTable().clear().destroy();
		}
		oldViewLogData(parseInt(viewLogsPerPage), parseInt(viewLogsCurrentPage), viewLogsItemId);
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
		$('#view-new-item-logs-modal-slide-in').modal('show');
		$('.overlay, body').removeClass('loaded');
		$('.overlay').css({ 'display': 'block' });
		if ($.fn.DataTable.isDataTable('#view-logs-data-table')) {
			$('#view-logs-data-table').DataTable().clear().destroy();
		}
		$('#view-logs-data-table tbody').empty();
		if (emailLogsTable_log) {
			$("#table-content").empty();
			emailLogsTable_log.clear().draw();
		}
		viewLogsItemId = null;
		viewLogsType = null;
	}

	async function oldViewLogData(perPage, currentPage, uniqueId) {
		if (!$.fn.DataTable.isDataTable('#view-logs-data-table')) {
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
		} else {
			viewLogsTable.clear();
		}
		console.log("ASdasd");
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
					])
				});

				viewLogsTable.draw(false);
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

	function getUrlParameter(sParam) {
		let sPageURL = window.location.search.substring(1),
			sURLVariables = sPageURL.split('&'),
			sParameterName,
			i;

		for (i = 0; i < sURLVariables.length; i++) {
			sParameterName = sURLVariables[i].split('=');

			if (sParameterName[0] === sParam) {
				return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
			}
		}
		return '';
	}

	if ($('#form-reviewed-save-create').length) {
		formValidator = $('#form-reviewed-save-create').validate({
			rules: {},
			messages: {},
			submitHandler: function (form) {
				handleReviewSubmit();
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

		function handleReviewSubmit() {
			$('#form-reviewed-save-create').find('button[type="submit"]').prop('disabled', true);
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({ 'display': 'block' });

			const data = {
				comment: $('#reviewed-save-value').val(),
				uniqueIds: selectedUniqueIds
			};

			$.ajax({
				url: '/logs/review/save',
				method: 'POST',
				data: data,
				success: function (response) {
					if (response.status === 1) {
						let companyId = $('#select-log-company').val();
						let projectId = $('#select-log-project').val();
						let environmentId = $('#select-log-environment').val();
						let itemId = $('#select-log-item').val();
						let logDescription = $('#log-description').val();
						let loghttpstatus = $('#log-httpstatus').val();
						let logtriggerstatus = $('#select-log-trigger-status').val();
						let logUniqueId = $('#log-uniqueId').val();
						let logPath = $('#log-path').val();
						let reviewed_status = $('#select-log-reviewed').val();
						selectedUniqueIds = [];
						$('#reviewed_select_all').prop('checked', false);
						getdata(parseInt(perPage), parseInt(currentPage), companyId, projectId, environmentId, itemId, logDescription, loghttpstatus, viewFromDate,
							viewToDate, logtriggerstatus, logUniqueId, logPath, reviewed_status);

						$('#reviewed-save-modal-slide-in').modal('hide');
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
				complete: function () {
					$('#form-reviewed-save-create').find('button[type="submit"]').prop('disabled', false);
					$('.overlay').hide();
				}
			});

		}

		$('#update-reviewed-save').on('click', function (e) {
			e.preventDefault();
			const isValid = $('#form-reviewed-save-create').valid();
			if (isValid) {
				handleReviewSubmit(); // validator already approved
			}
		});
	}

	if ($('#form-log-description-create').length) {
		formValidator = $('#form-log-description-create').validate({
			rules: {

			},
			messages: {

			},
			submitHandler: function (form) {
				handleLogDescriptionFormSubmit();
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

		function handleLogDescriptionFormSubmit() {
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
						let companyId = $('#select-log-company').val();
						let projectId = $('#select-log-project').val();
						let environmentId = $('#select-log-environment').val();
						let itemId = $('#select-log-item').val();
						let logDescription = $('#log-description').val();
						let loghttpstatus = $('#log-httpstatus').val();
						let logtriggerstatus = $('#select-log-trigger-status').val();
						let logUniqueId = $('#log-uniqueId').val();
						let logPath = $('#log-path').val();
						let reviewed_status = $('#select-log-reviewed').val();
						getdata(parseInt(perPage), parseInt(currentPage), companyId, projectId, environmentId, itemId, logDescription, loghttpstatus, viewFromDate,
							viewToDate, logtriggerstatus, logUniqueId, logPath, reviewed_status);
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
				handleLogDescriptionFormSubmit(); // validator already approved
			}
		});
	}

	async function openReviewedComments(element) {
		const $element = $(element);
		const unique_id = $element.data('unique-id') || '';
		if (!unique_id) return true;
		reviwedUniqueId = unique_id;
		getReviewedByUniqueId(rcurrentPage, rPerPage);
		$('#reviewed-list-slide-in').modal('show');
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

async function openItemModal(element) {
	const $element = $(element);
	const itemId = $element.data('item-id') || '';

	if (!itemId) return;

	$('.overlay, body').removeClass('loaded');
	$('.overlay').css({ 'display': 'block' });

	try {
		feather.replace();
		$('#item-id').val(itemId);
		logsItemId = itemId;
		$('#outbound-endpoint-data-table tbody').empty();
		itemLogPage = true;
		formValidator = null;
		const numberedStepper = new Stepper(horizontalWizard);
		numberedStepper.to(1);

		await itemInit();

		$('.overlay').css({ 'display': 'none' });
		$('body').addClass('loaded');

		$('#item-create-modal-slide-in').modal('show');

	} catch (err) {
		console.error('Error opening modal:', err);
		$('.overlay').css({ 'display': 'none' });
		$('body').addClass('loaded');
	}
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
