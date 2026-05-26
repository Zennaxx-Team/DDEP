let isPartyPage = true,
	environmentLists = [],
	partyCompanyCode = '',
	isProjectLoading = false;

$(document).ready(async function () {
	let partyId = '',
		perPage = 50,
		currentPage = 1,
		partyTable;

	if ($('#party-data-table').length) {
		toggleIconState('addIcon', true);
	} else {
		toggleIconState('saveIcon', true);
	}

	$('body').on('click', '.addIcon', function () {
		clearFormFieldsParty();
		$('#select-party-company').val('').trigger('change');
		$('#select-party-project').val('').trigger('change');
		$('#party-modal-label').text('Create Party');
		$('#create-party').text('Create Party');
		$('#party-modal-slide-in').modal('show');
	});

	if ($('#party-data-table').length) {
		perPage = 50,
			currentPage = 1,
			partyTable = $('#party-data-table').DataTable({
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: perPage,
				pagingType: 'full_numbers',
				searching: false
			});

		getParties(parseInt(perPage), parseInt(currentPage));

		$('body').on('click', '#party-data-table_paginate .paginate_button', function () {
			currentPage = $(this).attr('data-pageno');
			partyTable.clear();
			partyTable.destroy();
			partyTable = $('#party-data-table').DataTable({
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: perPage,
				pagingType: 'full_numbers',
				searching: false
			});
			getParties(parseInt(perPage), parseInt(currentPage));
		});

		$('body').on('change', '#party-data-table_length select', function () {
			perPage = $('#party-data-table_length select').val();
			currentPage = 1;
			partyTable.clear();
			partyTable.destroy();
			partyTable = $('#party-data-table').DataTable({
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: perPage,
				pagingType: 'full_numbers',
				searching: false
			});
			getParties(parseInt(perPage), parseInt(currentPage));
		});

		function getParties(perPage, currentPage) {
			partyTable.clear().draw();
			$('#party-data-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

			$.ajax({
				url: '/master/parties/list',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ page: parseInt(currentPage), limit: parseInt(perPage) }),
				success: function (response) {
					let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
					let totalRecord = parseInt(response.total);

					if (response.data === undefined || response.data.length <= 0) {
						$('#party-data-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty">No data available in table</td></tr>');
					}

					$.each(response.data, function (index, data) {
						let $switchActive = '<div class="demo-inline-spacing"><div class="custom-control custom-switch custom-control-inline"><input type="checkbox" class="custom-control-input is-active-button" id="custom-switch-' + index + '" data-id="' + data._id + '"';
						$switchActive += data.isActive ? 'checked ' : '';
						$switchActive += '/><label class="custom-control-label" for="custom-switch-' + index + '"></label></div></div>';

						let $buttonGroup = '<div class="btn-group" role="group" aria-label="Basic example">';
						$buttonGroup += '<a href="#" class="btn btn-outline-secondary" data-toggle="tooltip" title="Clone"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></a>';

						$buttonGroup += '<button type="button" class="btn btn-outline-secondary party-model" data-toggle="tooltip" title="Edit" data-id="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>';

						var row = partyTable.row.add([
							counter++,
							data.name,
							data?.companies?.name || data?.companyId || '',
							data?.projects?.name || data?.projectId || '',
							data.createdBy,
							dateFormat(data.createdAt),
							dateFormat(data.updatedAt),
							$switchActive,
							$buttonGroup
						])

						partyTable.row(row).draw(false);
					});

					$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
					let startEntry = (parseInt(currentPage) == 1) ? 1 : ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1);
					let endEntry = (parseInt(currentPage) == 1) ? parseInt(perPage) : (parseInt(perPage) * parseInt(currentPage));
					endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

					if (totalRecord == 0) {
						startEntry = 0;
					}

					let showpage = 'Showing ' + startEntry + ' to ' + endEntry + ' of ' + totalRecord + ' entries';
					$('body').find('#party-data-table_info').html(showpage);

					let dataDtIdx = 0;
					let paginationHtml = '';
					let firstDisable = (parseInt(currentPage) == 1) ? 'disabled' : '';
					let lastDisable = (parseInt(currentPage) == Math.ceil(totalRecord / parseInt(perPage))) ? 'disabled' : '';

					if (Math.ceil(totalRecord / parseInt(perPage)) > 0) {
						paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="party-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="party-data-table_first_1" data-pageno="1">First</a>';
						dataDtIdx++;
						paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="party-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="party-data-table_previous_1" data-pageno="' + (parseInt(currentPage) - 1) + '">Previous</a>';
						paginationHtml += '<span>';
						dataDtIdx++;

						if (parseInt(currentPage) > 2) {
							paginationHtml += '<a class="paginate_button" aria-controls="party-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
							if (parseInt(currentPage) > 3) {
								paginationHtml += '<span class="ellipsis">...</span>';
							}
							dataDtIdx++;
						}

						if ((parseInt(currentPage) - 1) > 0) {
							paginationHtml += '<a class="paginate_button" aria-controls="party-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) - 1) + '">' + (parseInt(currentPage) - 1) + '</a>';
							dataDtIdx++;
						}

						paginationHtml += '<a class="paginate_button current" aria-controls="party-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(currentPage) + '">' + parseInt(currentPage) + '</a>';
						dataDtIdx++;

						if ((parseInt(currentPage) + 1) < Math.ceil(totalRecord / parseInt(perPage)) + 1) {
							paginationHtml += '<a class="paginate_button" aria-controls="party-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) + 1) + '">' + (parseInt(currentPage) + 1) + '</a>';
							dataDtIdx++;
						}

						if (parseInt(currentPage) < Math.ceil(totalRecord / parseInt(perPage)) - 1) {
							if (((parseInt(currentPage) + 3) < Math.ceil(totalRecord / parseInt(perPage)) + 1)) {
								paginationHtml += '<span class="ellipsis">...</span>';
							}
							paginationHtml += '<a class="paginate_button" aria-controls="party-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">' + Math.ceil(totalRecord / parseInt(perPage)) + '</a>';
							dataDtIdx++;
						}

						paginationHtml += '</span>';
						paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="party-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="party-data-table_next_1" data-pageno="' + (parseInt(currentPage) + 1) + '">Next</a>';
						dataDtIdx++;
						paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="party-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="party-data-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">Last</a>';
					}

					$('body').find('#party-data-table_paginate').html(paginationHtml);
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

	$('body').on('change', '.is-active-button', function () {
		$this = $(this);
		Swal.fire({
			title: 'Are you sure?',
			text: ($this.is(':checked')) ? `You want to active this party?` : `You want to inactive this party?`,
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
				const partyId = $this.data('id');

				$.ajax({
					url: '/master/parties/status/' + partyId,
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

	$('body').on('click', 'button.party-model', function () {
		clearFormFieldsParty();
		partyId = $(this).attr('data-id');
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
	});

	if ($('#add-environment').length) {
		const $envForm = $('#form-party-create');

		$('body').on('click', '#add-environment', function () {
			const $selectEnv = $('#select-party-environment');
			const $domain = $('#domain');

			clearErrors();
			$selectEnv.removeClass('error is-invalid');
			$domain.removeClass('error is-invalid');
			$selectEnv.next('span.error').remove();
			$domain.next('span.error').remove();

			// Clear old error messages
			$envForm.validate().resetForm();

			// Manually validate required fields for environment
			let hasError = false;

			if (!$selectEnv.val()) {
				showError($selectEnv, 'Please select the Environment Name!');
				hasError = true;
			}

			if (!$domain.val().trim()) {
				showError($domain, 'Please enter the Domain!');
				hasError = true;
			}

			if (hasError) return;

			if ($selectEnv.val() && domain) {
				environmentLists.push({
					environmentId: $selectEnv.val(),
					environment: $selectEnv.find('option:selected').data('name'),
					domainPrefix: $('#select-domain-prefix').val(),
					domain: $domain.val().trim(),
					createdAt: dateFormat(new Date()),
					updatedAt: dateFormat(new Date())
				});
				clearEnvironmentSubmitError();
			}

			updateEnvironmentTable();

			// Clear input values
			$selectEnv.val('').trigger('change');
			$('#select-domain-prefix').val('http://').trigger('change');
			$domain.val('');

			// Clear any errors
			$envForm.validate().resetForm();
			clearErrors();
			$selectEnv.removeClass('error is-invalid');
			$domain.removeClass('error is-invalid');
			$selectEnv.next('span.error').remove();
			$domain.next('span.error').remove();
		});

		// Delete environment row
		$('body table').on('click', '.delete-environment', function () {
			const index = $(this).data('index');
			environmentLists.splice(index, 1);
			updateEnvironmentTable();
		});
	}

	if ($('#form-party-create').length) {
		formValidator = $('#form-party-create').validate({
			rules: {
				'select-party-company': {
					required: true
				},
				'select-party-project': {
					required: true
				},
				'party-name': {
					required: true
				},
				'party-sequence': {
					digits: true
				}
			},
			messages: {
				'select-party-company': {
					required: 'Please select the Company!'
				},
				'select-party-project': {
					required: 'Please select the Project!'
				},
				'party-name': {
					required: 'Please enter the Party Name!'
				},
				'party-sequence': {
					digits: 'Only numeric digits are allowed!'
				}
			},
			submitHandler: function (form) {
				const $selectEnv = $('#select-party-environment');
				const $domain = $('#domain');
				const envVal = $selectEnv.val();
				const domainVal = $domain.val().trim();

				if (environmentLists.length === 0) {
					showEnvironmentSubmitError("Please add at least one environment!");
					return;
				}
				if (!envVal && domainVal) {
					clearErrors();
					showError($selectEnv, 'Please select the Environment Name!');
					showEnvironmentSubmitError("Please complete the environment entry or clear it.");
					return;
				}

				clearEnvironmentSubmitError();
				handlePartyFormSubmit();
			},
			errorPlacement: function (error, element) {
				clearErrorForElement(element);
				showError(element, error.text());
			}
		});

		partyInit();
	}

	function debounce(func, wait) {
		let timeout;
		return function () {
			const context = this, args = arguments;
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				func.apply(context, args);
			}, wait);
		};
	}

	$('#select-party-company').on('change.select2', debounce(async function () {
		if (!$(this).data('programmaticChange')) {
			const selectedCompany = $(this).val();
			await partyProject(selectedCompany, $(this).data('project_id'));
		}
	}, 300));

	$('#select-party-project').on('change.select2', debounce(async function () {
		if (!$(this).data('programmaticChange')) {
			let selectedProject = $(this).val();
			const selectedCompany = $('#select-party-company').val();
			await partyEnvironment(selectedCompany, selectedProject);
		}
	}, 300));

	async function partyInit() {
		const responseCompanies = await getAllCompanies();
		if (responseCompanies.status === 1) {
			const selectCompany = document.getElementById('select-party-company');
			selectCompany.innerHTML = '<option value="">-- Please Select --</option>';

			responseCompanies.data.forEach(item => {
				const option = document.createElement('option');
				option.value = item._id;
				option.textContent = item.name;
				option.setAttribute('data-name', item.name);

				selectCompany.appendChild(option);
			});
		}

		await editParty();
	}

	async function handlePartyFormSubmit() {
		$('#form-party-create').find('button[type="submit"]').prop('disabled', true);

		$('.overlay, body').removeClass('loaded');
		$('.overlay').css({ 'display': 'block' });

		const data = {
			companyId: $('#select-party-company').val(),
			projectId: $('#select-party-project').val() == " " ? null : $('#select-party-project').val(),
			partyName: $('#party-name').val(),
			partyDescription: $('#party-description').val(),
			sequence: $('#party-sequence').val(),
			isActive: $('#is-party-active').is(':checked') ? 1 : 0,
			environments: environmentLists,
			companyCode: partyCompanyCode
		};

		const id = $('#party-id').val();
		const apiUrl = (!id) ? '/master/parties/create' : '/master/parties/update/' + id;
		const method = (!id) ? 'POST' : 'PUT';

		await $.ajax({
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

					if (isPartyPage) {
						getParties(parseInt(perPage), parseInt(currentPage));
						$('#party-modal-slide-in').modal('hide');
					} else if (!isPartyPage) {
						updatePartyOptions();
					}
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
				$('#form-party-create').find('button[type="submit"]').prop('disabled', false);
			},
			error: function (xhr, status, error) {
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });
				$('#form-party-create').find('button[type="submit"]').prop('disabled', false);

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

	function showEnvironmentSubmitError(message) {
		const $submitBtn = $('#form-party-create button[type="submit"]');
		if ($submitBtn.next('.environment-submit-error').length === 0) {
			$('<span class="environment-submit-error text-danger ml-2"></span>')
				.text(message)
				.insertAfter($submitBtn);
		} else {
			$submitBtn.next('.environment-submit-error').text(message);
		}
	}

	function clearEnvironmentSubmitError() {
		$('.environment-submit-error').remove();
	}
})

function clearFormFieldsParty() {
	clearErrors();
	$('#party-id').val('');
	$('#select-party-company').val(''); // Don't trigger change
	$('#party-name').val('');
	$('#party-sequence').val('');
	$('#party-description').val('');
	$('#is-party-active').prop('checked', true);
	$('#environment-listing tbody').empty();
	environmentLists = [];
	partyCompanyCode = '';
	partyId = '';
	$('#select-party-environment').removeClass('error is-invalid');
	$('#domain').removeClass('error is-invalid');
	$('#select-party-environment').next('span.error').remove();
	$('#domain').next('span.error').remove();

	$('#select-party-environment').rules('remove');
	$('#domain').rules('remove');
	$('#party-modal-label').text('Create Party');
	$('#create-party').text('Create Party');
}

function editParty() {
	return new Promise((resolve, reject) => {
		const id = $('#party-id').val();
		if (id) {
			$.ajax({
				url: '/master/parties/get/' + id,
				method: 'GET',
				success: async function (response) {
					if (response.status === 1) {
						const data = response?.data;
						const selectCompany = $('#select-party-company');
						const selectProject = $('#select-party-project');

						selectCompany.data('programmaticChange', true);
						selectCompany.val(data.companyId).trigger('change');
						selectCompany.data('project_id', data.projectId);
						selectProject.data('programmaticChange', true);
						await partyProject(data.companyId, data.projectId);
						await partyEnvironment(data.companyId, data.projectId);

						$('#party-name').val(data.name);
						$('#party-description').val(data.description);
						$('#party-sequence').val(data.sequence);

						if (data.isActive) {
							$('#is-party-active').prop('checked', true);
						} else {
							$('#is-party-active').prop('checked', false);
						}

						if (data.environments.length > 0) {
							environmentLists = data.environments;
							updateEnvironmentTable();
						} else {
							environmentLists = [];
						}

						partyCompanyCode = data.companyCode;

						selectCompany.data('programmaticChange', false);
						selectProject.data('programmaticChange', false);
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

function updateEnvironmentTable() {
	const tableBody = $('#environment-listing tbody');
	tableBody.empty();

	environmentLists.forEach((item, index) => {
		if (item?.environment) {
			tableBody.append(`
				<tr>
					<td>${item?.environment}</td>
					<td>${item?.domainPrefix}${item?.domain}</td>
					<td>${dateFormat(item.createdAt)}</td>
					<td>${dateFormat(item.updatedAt)}</td>
					<td><button class="btn btn-outline-secondary btn-sm delete-environment" data-index="${index}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button></td>
				</tr>
			`);
		}
	});
}

async function partyProject(companyId, projectId = '', clearProjectSelect = false) {
	if (!companyId) return;
	isProjectLoading = true;
	const responseProjects = await getAllCompanyProjects(companyId);
	const $selectProject = $('#select-party-project');
	$selectProject.prop('disabled', true);
	const selectProject = $selectProject[0];

	selectProject.innerHTML = '<option value="">-- Please Select --</option>';

	const defaultOption = new Option('Default', ' ');
	defaultOption.setAttribute('data-name', 'Default');
	selectProject.add(defaultOption);

	if (responseProjects.status === 1) {
		responseProjects.data.forEach(item => {
			const option = new Option(item.name, item._id);
			option.setAttribute('data-name', item.name);
			selectProject.add(option);
		});

		const selectedValue = clearProjectSelect ? '' : (projectId ?? ' ');

		await new Promise((resolve) => {
			let retryCount = 0;

			function waitForOption() {
				const exists = [...selectProject.options].some(opt => opt.value === selectedValue);
				if (exists || retryCount >= 50) {
					$selectProject.data('programmaticChange', true);
					$selectProject.val(exists ? selectedValue : ' ').trigger('change.select2');
					setTimeout(() => {
						$selectProject.data('programmaticChange', false);
						resolve();
					}, 10);
				} else {
					retryCount++;
					setTimeout(waitForOption, 50);
				}
			}

			waitForOption();
		});
	}

	isProjectLoading = false;
	$selectProject.prop('disabled', false);
}

async function partyEnvironment(companyId, projectId) {
	if (companyId !== '' && projectId !== '') {
		const responseEnvironments = await getAllProjectEnvironments(companyId, projectId);
		if (responseEnvironments.status === 1) {
			const selectEnvironment = document.getElementById('select-party-environment');
			selectEnvironment.innerHTML = '<option value="">-- Please Select --</option>';

			responseEnvironments.data.forEach(item => {
				const option = document.createElement('option');
				option.value = item._id;
				option.textContent = item.name;
				option.setAttribute('data-name', item.name);

				selectEnvironment.appendChild(option);
			});
		}
	}
}