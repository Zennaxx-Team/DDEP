let permissionLists = [],
	projectCompanyCode = '',
	isProjectPage = true;

$(document).ready(async function () {
	let projectId = '',
		perPage = 50,
		currentPage = 1,
		table;
	if ($('#project-data-table').length) {
		const permissions = JSON.parse(decodeURIComponent(getCookie("permissions")));
		if (permissions?.isAdmin || permissions?.canCreateProjects) {
			toggleIconState('addIcon', true);
		} else {
			toggleIconState('addIcon', false);
		}
	} else {
		toggleIconState('saveIcon', true);
	}

	$('body').on('click', '.addIcon', function () {
		clearFormFieldsProject();
		$('#project-modal-label').text('Create Project');
		$('#create-project').text('Create Project');
		$('#project-create-modal-slide-in').modal('show');
	});

	if ($('#project-data-table').length) {
		perPage = 50;
		currentPage = 1;
		table = $('#project-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			searching: false
		});

		getProjects(parseInt(perPage), parseInt(currentPage));

		$('body').on('click', '#project-data-table_paginate .paginate_button', function () {
			currentPage = $(this).attr('data-pageno');
			table.clear();
			table.destroy();
			table = $('#project-data-table').DataTable({
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: perPage,
				pagingType: 'full_numbers',
				searching: false
			});
			getProjects(parseInt(perPage), parseInt(currentPage));
		});

		$('body').on('change', '#project-data-table_length select', function () {
			perPage = $('#project-data-table_length select').val();
			currentPage = 1;
			table.clear();
			table.destroy();
			table = $('#project-data-table').DataTable({
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: perPage,
				pagingType: 'full_numbers',
				searching: false
			});
			getProjects(parseInt(perPage), parseInt(currentPage));
		});

		function getProjects(perPage, currentPage) {
			$('#project-data-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

			$.ajax({
				url: '/master/projects/list',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ page: parseInt(currentPage), limit: parseInt(perPage) }),
				success: function (response) {
					const permissions = JSON.parse(decodeURIComponent(getCookie("permissions")));
					let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
					let totalRecord = parseInt(response.total);

					if (response.data === undefined || response.data.length <= 0) {
						$('#project-data-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty">No data available in table</td></tr>');
					}

					$.each(response.data, function (index, data) {
						let $switchActive = '<div class="demo-inline-spacing"><div class="custom-control custom-switch custom-control-inline"><input type="checkbox" class="custom-control-input is-active-button" id="custom-switch-' + index + '" data-id="' + data._id + '"';
						$switchActive += data.isActive ? 'checked ' : '';
						$switchActive += '/><label class="custom-control-label" for="custom-switch-' + index + '"></label></div></div>';

						let $buttonGroup = '<div class="btn-group" role="group" aria-label="Basic example">';
						$buttonGroup += '<a href="#" class="btn btn-outline-secondary" data-toggle="tooltip" title="Clone"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></a>';

						if (permissions?.isAdmin || permissions?.canModifyProjects) {
							$buttonGroup += '<button type="button" class="btn btn-outline-secondary project-create-model" data-toggle="tooltip" title="Edit" data-id="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>';
						}
						$buttonGroup += '</div>';

						var row = table.row.add([
							counter++,
							data?.companies?.name || data?.companyId || '',
							data.name,
							data.description,
							data.membersTotal,
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
					$('body').find('#project-data-table_info').html(showpage);

					let dataDtIdx = 0;
					let paginationHtml = '';
					let firstDisable = (parseInt(currentPage) == 1) ? 'disabled' : '';
					let lastDisable = (parseInt(currentPage) == Math.ceil(totalRecord / parseInt(perPage))) ? 'disabled' : '';

					if (Math.ceil(totalRecord / parseInt(perPage)) > 0) {
						paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="project-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="project-data-table_first_1" data-pageno="1">First</a>';
						dataDtIdx++;
						paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="project-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="project-data-table_previous_1" data-pageno="' + (parseInt(currentPage) - 1) + '">Previous</a>';
						paginationHtml += '<span>';
						dataDtIdx++;

						if (parseInt(currentPage) > 2) {
							paginationHtml += '<a class="paginate_button" aria-controls="project-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
							if (parseInt(currentPage) > 3) {
								paginationHtml += '<span class="ellipsis">...</span>';
							}
							dataDtIdx++;
						}

						if ((parseInt(currentPage) - 1) > 0) {
							paginationHtml += '<a class="paginate_button" aria-controls="project-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) - 1) + '">' + (parseInt(currentPage) - 1) + '</a>';
							dataDtIdx++;
						}

						paginationHtml += '<a class="paginate_button current" aria-controls="project-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(currentPage) + '">' + parseInt(currentPage) + '</a>';
						dataDtIdx++;

						if ((parseInt(currentPage) + 1) < Math.ceil(totalRecord / parseInt(perPage)) + 1) {
							paginationHtml += '<a class="paginate_button" aria-controls="project-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) + 1) + '">' + (parseInt(currentPage) + 1) + '</a>';
							dataDtIdx++;
						}

						if (parseInt(currentPage) < Math.ceil(totalRecord / parseInt(perPage)) - 1) {
							if (((parseInt(currentPage) + 3) < Math.ceil(totalRecord / parseInt(perPage)) + 1)) {
								paginationHtml += '<span class="ellipsis">...</span>';
							}
							paginationHtml += '<a class="paginate_button" aria-controls="project-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">' + Math.ceil(totalRecord / parseInt(perPage)) + '</a>';
							dataDtIdx++;
						}

						paginationHtml += '</span>';
						paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="project-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="project-data-table_next_1" data-pageno="' + (parseInt(currentPage) + 1) + '">Next</a>';
						dataDtIdx++;
						paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="project-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="project-data-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">Last</a>';
					}

					$('body').find('#project-data-table_paginate').html(paginationHtml);
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
			text: ($this.is(':checked')) ? `You want to active this project?` : `You want to inactive this project?`,
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
				const projectId = $this.data('id');

				$.ajax({
					url: '/master/projects/status/' + projectId,
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

	if ($('#add-permission').length) {
		$('body').on('click', '#add-permission', function () {
			const selectedUser = $('#select-user').val();
			const selectedUserName = $('#select-user option:selected').data('name');
			const selectedPermission = $('#select-permission').val();
			const selectedPermissionName = $('#select-permission option:selected').data('name');
			const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

			if (selectedUser && selectedPermission) {
				permissionLists.push({
					userId: selectedUser,
					user: selectedUserName,
					permissionId: selectedPermission,
					permission: selectedPermissionName,
					createdAt: dateFormat(new Date()),
					updatedAt: dateFormat(new Date())
				});

				updatePermissionTable();

				$('#select-user').val('').trigger('change');
				$('#select-permission').val('').trigger('change');
			}
		});


		$('body table').on('click', '.delete-permission', function (event) {
			const index = $(this).data('index');
			permissionLists.splice(index, 1);
			updatePermissionTable();
		});
	}

	$('body').on('click', 'button.project-create-model', function () {
		clearFormFieldsProject();
		projectId = $(this).attr('data-id');
		if (projectId) {
			$('#project-id').val(projectId);
			$('#project-modal-label').text('Update Project');
			$('#create-project').text('Update Project');
			editProject(projectId)
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
		$('#project-create-modal-slide-in').modal('show');
	});

	if ($('#form-project-create').length) {
		formValidator = $('#form-project-create').validate({
			rules: {
				'select-project-company': {
					required: true
				},
				'project-code': {
					required: true,
				},
				'project-name': {
					required: true
				},
				'project-sequence': {
					digits: true
				}
			},
			messages: {
				'select-project-company': {
					required: 'Please select the Company!'
				},
				'project-code': {
					required: 'Please enter the Project Code!',
				},
				'project-name': {
					required: 'Please enter the Project Name!'
				},
				'project-sequence': {
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
			$('#form-project-create').find('button[type="submit"]').prop('disabled', true);
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({ 'display': 'block' });

			setCookie('createProjectSelectedCompany', $('#select-project-company').val(), 10);

			const data = {
				companyId: $('#select-project-company').val(),
				projectCode: $('#project-code').val(),
				projectName: $('#project-name').val(),
				sequence: $('#project-sequence').val(),
				email: $('#userProjectEmail').val(),
				emailTitle: $('#email-title').val(),
				projectDescription: $('#project-description').val(),
				isUrlPerfix: $('#is-project-urlprefix').is(':checked') ? 1 : 0,
				isActive: $('#is-project-active').is(':checked') ? 1 : 0,
				permissions: permissionLists,
				companyCode: projectCompanyCode
			};

			const id = $('#project-id').val();
			const apiUrl = (!id) ? '/master/projects/create' : '/master/projects/update/' + id;
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
						if (isProjectPage) {
							table.clear().draw();
							getProjects(parseInt(perPage), parseInt(currentPage));
						} else {
							updateProjectOptions();
						}
						$('#project-create-modal-slide-in').modal('hide');
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
					$('#form-project-create').find('button[type="submit"]').prop('disabled', false);
				},
				error: function (xhr, status, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });
					$('#form-project-create').find('button[type="submit"]').prop('disabled', false);

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
			success: function (response) {
				if (response.status == 1) {
					const selectCompany = document.getElementById('select-project-company');
					selectCompany.innerHTML = '<option value="">-- Please Select --</option>';

					response.data.forEach(item => {
						const option = document.createElement('option');
						option.value = item._id;
						option.textContent = item.name;
						option.setAttribute('data-name', item.name);

						selectCompany.appendChild(option);
					});

					const selectedCompanyValue = getCookie('createProjectSelectedCompany');
					if (selectedCompanyValue) {
						selectCompany.value = selectedCompanyValue;
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

		await $.ajax({
			url: '/permissions/all',
			method: 'GET',
			success: function (response) {
				if (response.status == 1) {
					const selectPermission = document.getElementById('select-permission');
					selectPermission.innerHTML = '<option value="">-- Please Select --</option>';

					response.data.forEach(item => {
						const option = document.createElement('option');
						option.value = item._id;
						option.textContent = item.name;
						option.setAttribute('data-name', item.name);

						selectPermission.appendChild(option);
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

		await $.ajax({
			url: '/users/all',
			method: 'GET',
			success: function (response) {
				if (response.status == 1) {
					const selectUser = document.getElementById('select-user');
					selectUser.innerHTML = '<option value="">Selete DDEP Username or User group Here</option>';

					response.data.forEach(item => {
						const option = document.createElement('option');
						option.value = item.user_name;
						option.textContent = item.user_name;
						option.setAttribute('data-name', item.user_name);

						selectUser.appendChild(option);
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

		await editProject();
	}

});

function updatePermissionTable() {
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

function clearFormFieldsProject() {
	clearErrors();
	permissionLists = [];
	$('#project-id').val('');
	$('#select-project-company').val('').trigger('change');
	$('#project-code').val('');
	$('#project-name').val('');
	$('#project-sequence').val('');
	$('#project-description').val('');
	$('#email-title').val('');
	$('#userProjectEmail').val('');
	$('#is-project-urlprefix').prop('checked', false);
	$('#is-project-active').prop('checked', true);
	$('#permission-listing tbody').empty();
	$('#project-modal-label').text('Create Project');
	$('#create-project').text('Create Project');
}

function editProject() {
	return new Promise((resolve, reject) => {
		const id = $('#project-id').val();
		if (id) {
			$.ajax({
				url: '/master/projects/get/' + id,
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
						$('#email-title').val(data.emailTitle);
						$('#userProjectEmail').val(data.email);

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
							updatePermissionTable();
						}

						projectCompanyCode = data.companyCode;
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