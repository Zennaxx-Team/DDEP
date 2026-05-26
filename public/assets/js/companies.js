let companyCompanyCode = '',
	isCompanyPage = true;

$(document).ready(async function () {
	let companyId = '',
		table,
		perPage = 50,
		currentPage = 1;

	if ($('#company-data-table').length) {
		toggleIconState('addIcon', true);
	} else {
		toggleIconState('saveIcon', true);
	}

	$('body').on('click', '.addIcon', function () {
		clearFormFieldsCompany();
		$('#company-modal-label').text('Create Company');
		$('#create-company').text('Create Company');
		$('#company-create-modal-slide-in').modal('show');
	});

	if ($('#company-data-table').length) {
		table = $('#company-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			searching: false
		});

		getCompanies(parseInt(perPage), parseInt(currentPage));

		$('body').on('click', '#company-data-table_paginate .paginate_button', function () {
			currentPage = $(this).attr('data-pageno');
			table.clear();
			table.destroy();
			table = $('#company-data-table').DataTable({
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: perPage,
				pagingType: 'full_numbers',
				searching: false
			});
			getCompanies(parseInt(perPage), parseInt(currentPage));
		});

		$('body').on('change', '#company-data-table_length select', function () {
			perPage = $('#company-data-table_length select').val();
			currentPage = 1;
			table.clear();
			table.destroy();
			table = $('#company-data-table').DataTable({
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: perPage,
				pagingType: 'full_numbers',
				searching: false
			});
			getCompanies(parseInt(perPage), parseInt(currentPage));
		});

		function getCompanies(perPage, currentPage) {
			$('#company-data-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

			$.ajax({
				url: '/master/companies/list',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ page: parseInt(currentPage), limit: parseInt(perPage) }),
				success: function (response) {
					let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
					let totalRecord = parseInt(response.total);

					if (response.data === undefined || response.data.length <= 0) {
						$('#company-data-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty">No data available in table</td></tr>');
					}

					$.each(response.data, function (index, data) {
						let $switchActive = '<div class="demo-inline-spacing"><div class="custom-control custom-switch custom-control-inline"><input type="checkbox" class="custom-control-input is-active-button" id="custom-switch-' + index + '" data-id="' + data._id + '"';
						$switchActive += data.isActive ? 'checked ' : '';
						$switchActive += '/><label class="custom-control-label" for="custom-switch-' + index + '"></label></div></div>';

						let $buttonGroup = '<div class="btn-group" role="group" aria-label="Basic example">';
						$buttonGroup += '<a href="#" class="btn btn-outline-secondary" data-toggle="tooltip" title="Clone"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></a>';

						$buttonGroup += '<button type="button" class="btn btn-outline-secondary company-create-model" data-toggle="tooltip" title="Edit" data-id="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>';
						$buttonGroup += '</div>';

						var row = table.row.add([
							counter++,
							data.name,
							data.projectsTotal,
							data.description,
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
					$('body').find('#company-data-table_info').html(showpage);

					let dataDtIdx = 0;
					let paginationHtml = '';
					let firstDisable = (parseInt(currentPage) == 1) ? 'disabled' : '';
					let lastDisable = (parseInt(currentPage) == Math.ceil(totalRecord / parseInt(perPage))) ? 'disabled' : '';

					if (Math.ceil(totalRecord / parseInt(perPage)) > 0) {
						paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="company-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="company-data-table_first_1" data-pageno="1">First</a>';
						dataDtIdx++;
						paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="company-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="company-data-table_previous_1" data-pageno="' + (parseInt(currentPage) - 1) + '">Previous</a>';
						paginationHtml += '<span>';
						dataDtIdx++;

						if (parseInt(currentPage) > 2) {
							paginationHtml += '<a class="paginate_button" aria-controls="company-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
							if (parseInt(currentPage) > 3) {
								paginationHtml += '<span class="ellipsis">...</span>';
							}
							dataDtIdx++;
						}

						if ((parseInt(currentPage) - 1) > 0) {
							paginationHtml += '<a class="paginate_button" aria-controls="company-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) - 1) + '">' + (parseInt(currentPage) - 1) + '</a>';
							dataDtIdx++;
						}

						paginationHtml += '<a class="paginate_button current" aria-controls="company-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(currentPage) + '">' + parseInt(currentPage) + '</a>';
						dataDtIdx++;

						if ((parseInt(currentPage) + 1) < Math.ceil(totalRecord / parseInt(perPage)) + 1) {
							paginationHtml += '<a class="paginate_button" aria-controls="company-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) + 1) + '">' + (parseInt(currentPage) + 1) + '</a>';
							dataDtIdx++;
						}

						if (parseInt(currentPage) < Math.ceil(totalRecord / parseInt(perPage)) - 1) {
							if (((parseInt(currentPage) + 3) < Math.ceil(totalRecord / parseInt(perPage)) + 1)) {
								paginationHtml += '<span class="ellipsis">...</span>';
							}
							paginationHtml += '<a class="paginate_button" aria-controls="company-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">' + Math.ceil(totalRecord / parseInt(perPage)) + '</a>';
							dataDtIdx++;
						}

						paginationHtml += '</span>';
						paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="company-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="company-data-table_next_1" data-pageno="' + (parseInt(currentPage) + 1) + '">Next</a>';
						dataDtIdx++;
						paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="company-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="company-data-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">Last</a>';
					}

					$('body').find('#company-data-table_paginate').html(paginationHtml);
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
			text: ($this.is(':checked')) ? `You want to active this company?` : `You want to inactive this company?`,
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
				const companyId = $this.data('id');

				$.ajax({
					url: '/master/companies/status/' + companyId,
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

	if ($('#form-company-create').length) {
		$.validator.addMethod("alphaOnly", function (value, element) {
			return this.optional(element) || /^[A-Za-z0-9]+$/.test(value);
		}, "Only alphabetic characters are allowed.");
		formValidator = $('#form-company-create').validate({
			rules: {
				'company-name': {
					required: true
				},
				'company-code': {
					required: true,
					remote: {
						url: '/master/companies/check-company-code-exist',
						type: 'POST',
						data: {
							code: function () {
								return $('#company-code').val();
							},
							companyId: function () {
								return $('#company-id').val();
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
				'default-project-prefix': {
					required: true,
					alphaOnly: true
				}, 
				'sequence': {
					digits: true
				}
			},
			messages: {
				'company-name': {
					required: 'Please enter the Company Name!'
				},
				'company-code': {
					required: 'Please enter the Company Code!',
					remote: 'Company code already exists!'
				},
				'default-project-prefix': {
					required: 'Please enter the Default Project Prefix!',
					alphaOnly: 'Only alphabetic characters are allowed!'
				},
				'sequence': {
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
			$('#form-company-create').find('button[type="submit"]').prop('disabled', true);
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({ 'display': 'block' });

			const data = {
				code: $('#company-code').val(),
				companyName: $('#company-name').val(),
				sequence: $('#sequence').val(),
				companyDescription: $('#company-description').val(),
				defaultProjectPrefix: $('#default-project-prefix').val(),
				isDisableDefaultProjectPrefix: $('#is-disable-default-project-prefix').is(':checked') ? 1 : 0,
				isActive: $('#is-company-active').is(':checked') ? 1 : 0,
				isUrlPerfix: $('#is-disable-company-urlprefix').is(':checked') ? 1 : 0,
				companyCode: companyCompanyCode
			};

			const id = $('#company-id').val();
			const apiUrl = (!id) ? '/master/companies/create' : '/master/companies/update/' + id;
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
						if (isCompanyPage) {
							table.clear().draw();
							$('#company-data-table tbody').empty();
							$('#company-data-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty"><div class="tableloader"></div></td></tr>');
							getCompanies(parseInt(perPage), parseInt(currentPage));
						} else {
							updateCompanyOptions();
						}
						$('#company-create-modal-slide-in').modal('hide');
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
					$('#form-company-create').find('button[type="submit"]').prop('disabled', false);
				},
				error: function (xhr, status, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });
					$('#form-company-create').find('button[type="submit"]').prop('disabled', false);

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

		// await editCompany();
	}

	$('body').on('click', 'button.company-create-model', function () {
		clearFormFieldsCompany();
		companyId = $(this).attr('data-id');
		if (companyId) {
			$('#company-id').val(companyId);
			$('#company-modal-label').text('Update Company');
			$('#create-company').text('Update Company');
			editCompany(companyId)
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
		$('#company-create-modal-slide-in').modal('show');
	});
});

function clearFormFieldsCompany() {
	clearErrors();
	$('#company-id').val('');
	$('#company-code').val('');
	$('#company-name').val('');
	$('#sequence').val('');
	$('#company-description').val('');
	$('#default-project-prefix').val('');
	$('#is-disable-default-project-prefix').prop('checked', false);
	$('#is-disable-company-urlprefix').prop('checked', false);
	$('#is-company-active').prop('checked', true);
	$('#company-modal-label').text('Create Company');
	$('#create-company').text('Create Company');
}

function editCompany() {
	return new Promise((resolve, reject) => {
		const id = $('#company-id').val();
		if (id) {
			$.ajax({
				url: '/master/companies/get/' + id,
				method: 'GET',
				success: function (response) {
					if (response.status === 1) {
						const data = response?.data;
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