let environmentCompanyCode = '',
	isEnvironmentsPage = true,
	isLoadingProjects = false,
	currentProjectRequest = null;

$(document).ready(async function () {
	let environmentId = '',
		table,
		perPage = 50,
		currentPage = 1;

	if ($('#environment-data-table').length) {
		toggleIconState('addIcon', true);
	} else {
		toggleIconState('saveIcon', true);
	}

	$('body').on('click', '.addIcon', function () {
		clearFormFieldsEnvironment();
		$('#environment-modal-label').text('Create Environment');
		$('#create-environment').text('Create Environment');
		$('#environment-create-modal-slide-in').modal('show');
	});

	if ($('#environment-data-table').length) {
		table = $('#environment-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			searching: false
		});

		getEnvironments(parseInt(perPage), parseInt(currentPage));

		$('body').on('click', '#environment-data-table_paginate .paginate_button', function () {
			currentPage = $(this).attr('data-pageno');
			table.clear();
			table.destroy();
			table = $('#environment-data-table').DataTable({
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: perPage,
				pagingType: 'full_numbers',
				searching: false
			});
			getEnvironments(parseInt(perPage), parseInt(currentPage));
		});

		$('body').on('change', '#environment-data-table_length select', function () {
			perPage = $('#environment-data-table_length select').val();
			currentPage = 1;
			table.clear();
			table.destroy();
			table = $('#environment-data-table').DataTable({
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: perPage,
				pagingType: 'full_numbers',
				searching: false
			});
			getEnvironments(parseInt(perPage), parseInt(currentPage));
		});

		function getEnvironments(perPage, currentPage) {
			table.clear().draw();
			$('#environment-data-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

			$.ajax({
				url: '/master/environments/list',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ page: parseInt(currentPage), limit: parseInt(perPage) }),
				success: function (response) {
					let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
					let totalRecord = parseInt(response.total);

					if (response.data === undefined || response.data.length <= 0) {
						$('#environment-data-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty">No data available in table</td></tr>');
					}

					$.each(response.data, function (index, data) {
						let $switchActive = '<div class="demo-inline-spacing"><div class="custom-control custom-switch custom-control-inline"><input type="checkbox" class="custom-control-input is-active-button" id="custom-switch-' + index + '" data-id="' + data._id + '"';
						$switchActive += data.isActive ? 'checked ' : '';
						$switchActive += '/><label class="custom-control-label" for="custom-switch-' + index + '"></label></div></div>';

						let $buttonGroup = '<div class="btn-group" role="group" aria-label="Basic example">';
						$buttonGroup += '<a href="#" class="btn btn-outline-secondary" data-toggle="tooltip" title="Clone"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></a>';

						$buttonGroup += '<button type="button" class="btn btn-outline-secondary environment-create-model" data-toggle="tooltip" title="Edit" data-id="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>';

						var row = table.row.add([
							counter++,
							data.name,
							data?.companies?.name || data?.companyId || '',
							data?.projects?.name || data?.projectId || '',
							data.ddepApiPrefix,
							data.createdBy,
							dateFormat(data.createdAt),
							dateFormat(data.updatedAt),
							$switchActive,
							$buttonGroup
						])

						table.row(row).draw(false);
					});

					$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
					let startEntry = (parseInt(currentPage) == 1) ? 1 : ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1);
					let endEntry = (parseInt(currentPage) == 1) ? parseInt(perPage) : (parseInt(perPage) * parseInt(currentPage));
					endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

					if (totalRecord == 0) {
						startEntry = 0;
					}

					let showpage = 'Showing ' + startEntry + ' to ' + endEntry + ' of ' + totalRecord + ' entries';
					$('body').find('#environment-data-table_info').html(showpage);

					let dataDtIdx = 0;
					let paginationHtml = '';
					let firstDisable = (parseInt(currentPage) == 1) ? 'disabled' : '';
					let lastDisable = (parseInt(currentPage) == Math.ceil(totalRecord / parseInt(perPage))) ? 'disabled' : '';

					if (Math.ceil(totalRecord / parseInt(perPage)) > 0) {
						paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="environment-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="environment-data-table_first_1" data-pageno="1">First</a>';
						dataDtIdx++;
						paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="environment-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="environment-data-table_previous_1" data-pageno="' + (parseInt(currentPage) - 1) + '">Previous</a>';
						paginationHtml += '<span>';
						dataDtIdx++;

						if (parseInt(currentPage) > 2) {
							paginationHtml += '<a class="paginate_button" aria-controls="environment-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
							if (parseInt(currentPage) > 3) {
								paginationHtml += '<span class="ellipsis">...</span>';
							}
							dataDtIdx++;
						}

						if ((parseInt(currentPage) - 1) > 0) {
							paginationHtml += '<a class="paginate_button" aria-controls="environment-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) - 1) + '">' + (parseInt(currentPage) - 1) + '</a>';
							dataDtIdx++;
						}

						paginationHtml += '<a class="paginate_button current" aria-controls="environment-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(currentPage) + '">' + parseInt(currentPage) + '</a>';
						dataDtIdx++;

						if ((parseInt(currentPage) + 1) < Math.ceil(totalRecord / parseInt(perPage)) + 1) {
							paginationHtml += '<a class="paginate_button" aria-controls="environment-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) + 1) + '">' + (parseInt(currentPage) + 1) + '</a>';
							dataDtIdx++;
						}

						if (parseInt(currentPage) < Math.ceil(totalRecord / parseInt(perPage)) - 1) {
							if (((parseInt(currentPage) + 3) < Math.ceil(totalRecord / parseInt(perPage)) + 1)) {
								paginationHtml += '<span class="ellipsis">...</span>';
							}
							paginationHtml += '<a class="paginate_button" aria-controls="environment-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">' + Math.ceil(totalRecord / parseInt(perPage)) + '</a>';
							dataDtIdx++;
						}

						paginationHtml += '</span>';
						paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="environment-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="environment-data-table_next_1" data-pageno="' + (parseInt(currentPage) + 1) + '">Next</a>';
						dataDtIdx++;
						paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="environment-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="environment-data-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">Last</a>';
					}

					$('body').find('#environment-data-table_paginate').html(paginationHtml);
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
			text: ($this.is(':checked')) ? `You want to active this environment?` : `You want to inactive this environment?`,
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
				const environmentId = $this.data('id');

				$.ajax({
					url: '/master/environments/status/' + environmentId,
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

	$('body').on('click', 'button.environment-create-model', function () {
		clearFormFieldsEnvironment();
		environmentId = $(this).attr('data-id');
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
	});

	if ($('#form-environment-create').length) {
		$.validator.addMethod(
			'regex',
			function (value, element, regexp) {
				var re = new RegExp(regexp);
				return this.optional(element) || re.test(value);
			},
			'DDEP API is not valid (must start with a ' / ' and must contain any letter, capitalize letter, number, dash or underscore)'
		);

		formValidator = $('#form-environment-create').validate({
			rules: {
				'select-environment-company': {
					required: true
				},
				'select-environment-project': {
					required: true
				},
				'environment-name': {
					required: true
				},
				'environment-api-prefix': {
					required: true,
					maxlength: 100,
					regex: /^(\/)[a-zA-Z0-9-_\/]+$/,
					remote: {
						url: '/master/environments/check-ddep-api-exist',
						type: 'POST',
						data: {
							ddepApiPrefix: function () {
								return $('#environment-api-prefix').val();
							},
							environmentId: function () {
								return $('#environment-id').val();
							},
							projectId: function () {
								return $('#select-environment-project').val() == " " ? null : $('#select-environment-project').val();
							},
							companyId: function () {
								return $('#select-environment-company').val();
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
				'environment-sequence' : {
					digits: true
				}
			},
			messages: {
				'select-environment-company': {
					required: 'Please select the Company!'
				},
				'select-environment-project': {
					required: 'Please select the Project!'
				},
				'environment-name': {
					required: 'Please enter the Environment Name!'
				},
				'environment-api-prefix': {
					required: 'Please enter the DDEP API Prefix!'
				},
				'environment-sequence': {
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

		function clearErrors() {
			$('.help-block').remove();
			$('.form-control').removeClass('error');
		}

		function clearErrorForElement(element) {
			const $input = $(element);
			$input.closest('.form-group').find('.help-block').remove();
			$input.removeClass('error');
		}

		function handleFormSubmit() {
			$('#form-environment-create').find('button[type="submit"]').prop('disabled', true);

			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({ 'display': 'block' });

			setCookie('createEnvironmentSelectedCompany', $('#select-environment-company').val(), 10);
			setCookie('createEnvironmentSelectedProject', $('#select-environment-project').val(), 10);

			const data = {
				companyId: $('#select-environment-company').val(),
				projectId: $('#select-environment-project').val() == " " ? null : $('#select-environment-project').val(),
				environmentName: $('#environment-name').val(),
				sequence: $('#environment-sequence').val(),
				ddepApiPrefix: $('#environment-api-prefix').val(),
				environmentDescription: $('#environment-description').val(),
				isUrlPerfix: $('#is-environment-urlprefix').is(':checked') ? 1 : 0,
				isActive: $('#is-environment-active').is(':checked') ? 1 : 0,
				companyCode: environmentCompanyCode
			};

			const id = $('#environment-id').val();
			const apiUrl = (!id) ? '/master/environments/create' : '/master/environments/update/' + id;
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
						if (isEnvironmentsPage) {
							getEnvironments(parseInt(perPage), parseInt(currentPage));
						} else {
							updateEnvironmentOptions();
						}
						$('#environment-create-modal-slide-in').modal('hide');
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
					$('#form-environment-create').find('button[type="submit"]').prop('disabled', false);
				},
				error: function (xhr, status, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });
					$('#form-environment-create').find('button[type="submit"]').prop('disabled', false);

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

		await $.ajax({
			url: '/master/companies/all',
			method: 'GET',
			success: async function (response) {
				if (response.status == 1) {
					const selectCompany = document.getElementById('select-environment-company');
					selectCompany.innerHTML = '<option value="">-- Please Select --</option>';

					response.data.forEach(item => {
						const option = document.createElement('option');
						option.value = item._id;
						option.textContent = item.name;
						option.setAttribute('data-name', item.name);

						selectCompany.appendChild(option);
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

				return false;
			}
		});

	}

	$('#select-environment-company').on('change.select2', async function () {
		if (!$(this).data('programmaticChange')) {
			const selectedCompany = $(this).val();
			const projectId = $(this).data('project_id') || '';
			await getEnvironmentProjects(selectedCompany, projectId, false);
		}
	});

	$('#select-environment-project').on('change.select2', function () {
		const selectedProject = $(this).val();
		const $ddepApiPrefix = $('#environment-api-prefix');
		const ddepApiValue = $ddepApiPrefix.val();

		if (ddepApiValue && selectedProject) {
			if (formValidator.element($ddepApiPrefix)) {
				clearErrorForElement($ddepApiPrefix);
			}
		}
	});
});


function clearFormFieldsEnvironment() {
	clearErrors();
	$('#environment-id').val('');
	$('#select-environment-company').val('').trigger('change');
	$('#select-environment-project').val('').trigger('change');
	$('#environment-name').val('');
	$('#environment-api-prefix').val('');
	$('#environment-description').val('');
	$('#environment-sequence').val('')
	$('#is-environment-urlprefix').prop('checked', false);
	$('#is-environment-active').prop('checked', true);
	$('#environment-modal-label').text('Create Environment');
	$('#create-environment').text('Create Environment');
}

async function editEnvironment() {
	return new Promise((resolve, reject) => {
		const id = $('#environment-id').val();
		if (id) {
			$.ajax({
				url: '/master/environments/get/' + id,
				method: 'GET',
				success: async function (response) {
					if (response.status === 1) {
						const data = response?.data;
						const selectCompany = $('#select-environment-company');
						const selectProject = $('#select-environment-project');

						selectCompany.data('programmaticChange', true);
						selectCompany.val(data.companyId).trigger('change');

						await getEnvironmentProjects(data.companyId, data.projectId, false);

						$('#environment-name').val(data.name);
						$('#environment-api-prefix').val(data.ddepApiPrefix);
						$('#environment-description').val(data.description);
						$('#environment-sequence').val(data.sequence);

						if (data.isUrlPerfix) {
							$('#is-environment-urlprefix').prop('checked', true);
						} else {
							$('#is-environment-urlprefix').prop('checked', false);
						}

						$('#is-environment-active').prop('checked', data.isActive);
						environmentCompanyCode = data.companyCode;
						selectCompany.data('programmaticChange', false);
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
		} else {
			const selectedCompanyValue = getCookie('selectedCompany');
			const selectCompany = $('#select-environment-company');
			selectCompany.val(selectedCompanyValue).trigger('change');
			getEnvironmentProjects(selectedCompanyValue, '', false);
		}
	});
}

function getEnvironmentProjects(companyId, projectId, clearProjectSelect = false) {
	// Validate inputs
	if (!companyId) {
		return Promise.resolve();
	}

	if (isLoadingProjects) {
		return currentProjectRequest;
	}

	isLoadingProjects = true;

	$('#form-environment-create').find('button[type="submit"]').prop('disabled', true);
	$('.overlay, body').removeClass('loaded');
	$('.overlay').css({ 'display': 'block' });

	currentProjectRequest = new Promise((resolve, reject) => {
		$.ajax({
			url: '/master/projects/all-company-project',
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ companyId }),
			success: function (response) {
				try {
					const selectProject = document.getElementById('select-environment-project');
					if (!selectProject) {
						throw new Error('Project select element not found');
					}

					// Clear existing options
					selectProject.innerHTML = '<option value="">-- Please Select --</option>';

					if (response.status == 1 && response.data) {
						const defaultOption = document.createElement('option');
						defaultOption.value = ' ';
						defaultOption.textContent = 'Default';
						defaultOption.setAttribute('data-name', 'Default');
						selectProject.appendChild(defaultOption);

						// Add all returned projects
						response.data.forEach(item => {
							if (item && item._id) {
								const option = document.createElement('option');
								option.value = item._id;
								option.textContent = item.name || 'Unnamed Project';
								option.setAttribute('data-name', item.name || 'Unnamed Project');
								selectProject.appendChild(option);
							}
						});

						if (!clearProjectSelect) {
							let selectedProjectValue = '';

							if (projectId && projectId !== null && projectId !== 'null') {
								selectedProjectValue = projectId;
							} else {
								selectedProjectValue = ' ';
							}

							const optionExists = Array.from(selectProject.options).some(
								opt => opt.value === selectedProjectValue
							);

							if (optionExists) {
								selectProject.value = selectedProjectValue;
							} else {
								console.warn(`Project option ${selectedProjectValue} not found, falling back to default`);
								selectProject.value = ' ';
							}
						} else {
							selectProject.value = '';
						}

						$(selectProject).trigger('change');
					} else {
						throw new Error(response.message || 'Failed to load projects');
					}

					resolve(response);
				} catch (error) {
					console.error('Error processing project response:', error);
					reject(error);
				}
			},
			error: function (xhr, status, error) {
				const errorMessage = xhr?.responseJSON?.message || `Request failed: ${error}`;
				console.error('Project loading error:', errorMessage);

				Swal.fire({
					title: 'Error!',
					text: errorMessage,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});

				reject(new Error(errorMessage));
			},
			complete: function () {
				// Always cleanup regardless of success/error
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });
				$('#form-environment-create').find('button[type="submit"]').prop('disabled', false);

				// Reset loading state
				isLoadingProjects = false;
				currentProjectRequest = null;
			}
		});
	});

	return currentProjectRequest;
}