let mappingProfileCompanyCode = '',
	isNewMappingProfile = false,
	filterCounter = 1,
	inOutAutocompleteDataArray = [],
	inboundAutocompleteDataArray = [],
	outboundAutocompleteDataArray = [],
	isMappingProfilePage = true,
	mappingProfileHistory = '';

if ($('#mapping-profile-data-table').length) {
	toggleIconState('addIcon', true);
} else {
	toggleIconState('saveIcon', true);
}

$('body').on('click', '.addIcon', function () {
	window.location.href = '/template/mapping-profiles/create';
});

if ($('#mapping-profile-data-table').length) {
	let perPage = 50,
		currentPage = 1,
		table = $('#mapping-profile-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			searching: false
		});

	getMappingProfiles(parseInt(perPage), parseInt(currentPage));

	$('body').on('click', '#mapping-profile-data-table_paginate .paginate_button', function () {
		currentPage = $(this).attr('data-pageno');
		table.clear();
		table.destroy();
		table = $('#mapping-profile-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			searching: false
		});
		getMappingProfiles(parseInt(perPage), parseInt(currentPage));
	});

	$('body').on('change', '#mapping-profile-data-table_length select', function () {
		perPage = $('#mapping-profile-data-table_length select').val();
		currentPage = 1;
		table.clear();
		table.destroy();
		table = $('#mapping-profile-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			searching: false
		});
		getMappingProfiles(parseInt(perPage), parseInt(currentPage));
	});

	function getMappingProfiles(perPage, currentPage) {
		$('#mapping-profile-data-table tbody').html('<tr class="odd"><td valign="top" colspan="8" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

		$.ajax({
			url: '/template/mapping-profiles/list',
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ page: parseInt(currentPage), limit: parseInt(perPage) }),
			success: function (response) {
				let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
				let totalRecord = parseInt(response.total);

				if (response.data === undefined || response.data.length <= 0) {
					$('#mapping-profile-data-table tbody').html('<tr class="odd"><td valign="top" colspan="8" class="dataTables_empty">No data available in table</td></tr>');
				}

				$.each(response.data, function (index, data) {
					let $switchActive = '<div class="demo-inline-spacing"><div class="custom-control custom-switch custom-control-inline"><input type="checkbox" class="custom-control-input is-active-button" id="custom-switch-' + index + '" data-id="' + data._id + '"';
					$switchActive += data.isActive ? 'checked ' : '';
					$switchActive += '/><label class="custom-control-label" for="custom-switch-' + index + '"></label></div></div>';

					let $buttonGroup = '<div class="btn-group" role="group" aria-label="Basic example">';
					$buttonGroup += '<a href="#" class="btn btn-outline-secondary" data-toggle="tooltip" title="Clone"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></a>';

					$buttonGroup += '<a href="mapping-profiles/edit/' + data._id + '/' + data.currentVersion._id + '" class="btn btn-outline-secondary" data-toggle="tooltip" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></a>';
					$buttonGroup += '</div>';

					let row = table.row.add([
						counter++,
						data?.currentVersion?.name || '',
						data?.companies?.name || '',
						data?.projects?.name || '',
						data?.currentVersion?.version || '',
						data?.currentVersion?.description || '',
						dateFormat(data.createdAt),
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
				$('body').find('#mapping-profile-data-table_info').html(showpage);

				let dataDtIdx = 0;
				let paginationHtml = '';
				let firstDisable = (parseInt(currentPage) == 1) ? 'disabled' : '';
				let lastDisable = (parseInt(currentPage) == Math.ceil(totalRecord / parseInt(perPage))) ? 'disabled' : '';

				if (Math.ceil(totalRecord / parseInt(perPage)) > 0) {
					paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="mapping-profile-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="mapping-profile-data-table_first_1" data-pageno="1">First</a>';
					dataDtIdx++;
					paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="mapping-profile-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="mapping-profile-data-table_previous_1" data-pageno="' + (parseInt(currentPage) - 1) + '">Previous</a>';
					paginationHtml += '<span>';
					dataDtIdx++;

					if (parseInt(currentPage) > 2) {
						paginationHtml += '<a class="paginate_button" aria-controls="mapping-profile-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
						if (parseInt(currentPage) > 3) {
							paginationHtml += '<span class="ellipsis">...</span>';
						}
						dataDtIdx++;
					}

					if ((parseInt(currentPage) - 1) > 0) {
						paginationHtml += '<a class="paginate_button" aria-controls="mapping-profile-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) - 1) + '">' + (parseInt(currentPage) - 1) + '</a>';
						dataDtIdx++;
					}

					paginationHtml += '<a class="paginate_button current" aria-controls="mapping-profile-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(currentPage) + '">' + parseInt(currentPage) + '</a>';
					dataDtIdx++;

					if ((parseInt(currentPage) + 1) < Math.ceil(totalRecord / parseInt(perPage)) + 1) {
						paginationHtml += '<a class="paginate_button" aria-controls="mapping-profile-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) + 1) + '">' + (parseInt(currentPage) + 1) + '</a>';
						dataDtIdx++;
					}

					if (parseInt(currentPage) < Math.ceil(totalRecord / parseInt(perPage)) - 1) {
						if (((parseInt(currentPage) + 3) < Math.ceil(totalRecord / parseInt(perPage)) + 1)) {
							paginationHtml += '<span class="ellipsis">...</span>';
						}
						paginationHtml += '<a class="paginate_button" aria-controls="mapping-profile-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">' + Math.ceil(totalRecord / parseInt(perPage)) + '</a>';
						dataDtIdx++;
					}

					paginationHtml += '</span>';
					paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="mapping-profile-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="mapping-profile-data-table_next_1" data-pageno="' + (parseInt(currentPage) + 1) + '">Next</a>';
					dataDtIdx++;
					paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="mapping-profile-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="mapping-profile-data-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">Last</a>';
				}

				$('body').find('#mapping-profile-data-table_paginate').html(paginationHtml);
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
		text: ($this.is(':checked')) ? `You want to active this mapping profile?` : `You want to inactive this mapping profile?`,
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
			const mappingProfileId = $this.data('id');

			$.ajax({
				url: '/template/mapping-profiles/status/' + mappingProfileId,
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

// Define validation rules once (global scope)
const validationRules = {
	rules: {
		'mapping-profile-name': { required: true },
		'select-mapping-company': { required: true },
		'select-project': { required: true },
		'version': { required: true }
	},
	messages: {
		'mapping-profile-name': {
			required: 'Please enter the Mapping Profile Name!'
		},
		'select-mapping-company': {
			required: 'Please select the Company!'
		},
		'select-project': {
			required: 'Please select the Project!'
		},
		'version': {
			required: 'Please select the Version!'
		}
	},
	errorPlacement: function (error, element) {
		clearErrorForElement(element);
		showError(element, error.text());
	},
	submitHandler: function () {
		handleMappingProfileFormSubmit();
	}
};

function initializeMappingProfileForm() {
	const $form = $('#form-mapping-profile-create');
	if ($form.length) {
		$('body').on('click', '#create-mapping-profile', () => {
			isNewMappingProfile = false;
		});

		$('body').on('click', '#update-mapping-profile', () => {
			isNewMappingProfile = true;
		});

		formValidator = $form.validate(validationRules);
		mappingProfileInit();
	}
}

initializeMappingProfileForm();

function initializeFormValidation() {
	if ($('#form-mapping-profile-create').length) {
		formValidator = $('#form-mapping-profile-create').validate(validationRules);
	}
}

$('body').on('click', '.save_publish_existing_version', function (e) {
	e.preventDefault();
	isNewMappingProfile = false;
	isMappingProfilePage = false;
	initializeFormValidation();
	if (formValidator) {
		if (formValidator.form()) {
			handleMappingProfileFormSubmit();
		} else {
			formValidator.focusInvalid();
		}
	}
});

$('body').on('click', '.save_publish_new_version', function (e) {
	e.preventDefault(); // Prevent default behavior
	isNewMappingProfile = true;
	isMappingProfilePage = false;
	initializeFormValidation();
	if (formValidator) {
		if (formValidator.form()) {
			handleMappingProfileFormSubmit();
		} else {
			formValidator.focusInvalid();
		}
	}
});

async function mappingProfileInit() {
	await $.ajax({
		url: '/master/companies/all',
		method: 'GET',
		success: async function (response) {
			if (response.status == 1) {
				const selectCompany = document.getElementById('select-mapping-company');
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

	// const responseProjects = await getAllCompanyProjects('');
	// if (responseProjects.status === 1) {
	// 	const selectProject = document.getElementById('select-project');
	// 	selectProject.innerHTML = '<option value="">-- Please Select --</option>';

	// 	responseProjects.data.forEach(item => {
	// 		const option = document.createElement('option');
	// 		option.value = item._id;
	// 		option.textContent = item.name;
	// 		option.setAttribute('data-name', item.name);

	// 		selectProject.appendChild(option);
	// 	});
	// }

	if ($('#mapping-profile-id').val() && $('#mapping-profile-history-id').val()) {
		await editMappingProfile($('#mapping-profile-id').val(), $('#mapping-profile-history-id').val());
	} else {
		const selectedCompanyValue = getCookie('selectedCompany');
		const selectedProjectValue = getCookie('selectedProject');
		const selectCompany = $('#select-mapping-company');
		const selectProject = $('#select-project');
		selectCompany.data('programmaticChange', true);
		selectProject.data('programmaticChange', true);
		if (selectedCompanyValue && selectedProjectValue) {
			selectCompany.val(selectedCompanyValue).trigger('change');
			await getProjectsMappingProfile(selectedCompanyValue, selectedProjectValue);
		} else {
			selectCompany.val(selectedCompanyValue).trigger('change');
			await getProjectsMappingProfile(selectedCompanyValue, '');
		}
	}
}

$('#select-mapping-company').on('change.select2', async function () {
	if (!$(this).data('programmaticChange')) {
		const selectedCompany = $(this).val();
		await getProjectsMappingProfile(selectedCompany, '', true);
	}
});

function getProjectsMappingProfile(companyId, projectId, clearProjectSelect = false) {
	if (companyId) {
		$('#form-environment-create').find('button[type="submit"]').prop('disabled', true);

		$('.overlay, body').removeClass('loaded');
		$('.overlay').css({ 'display': 'block' });

		$.ajax({
			url: '/master/projects/all-company-project',
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ companyId }),
			success: function (response) {
				if (response.status == 1) {
					const selectProject = document.getElementById('select-project');
					selectProject.innerHTML = '<option value="">-- Please Select --</option>';

					const defaultOption = document.createElement('option');
					defaultOption.value = ' ';
					defaultOption.textContent = 'Default';
					defaultOption.setAttribute('data-name', 'Default');
					selectProject.appendChild(defaultOption);

					response.data.forEach(item => {
						const option = document.createElement('option');
						option.value = item._id;
						option.textContent = item.name;
						option.setAttribute('data-name', item.name);

						selectProject.appendChild(option);
					});

					let selectedProjectValue;
					if (projectId != null) {
						selectedProjectValue = projectId;
					} else if (projectId == null) {
						selectedProjectValue = ' ';
					} else {
						selectedProjectValue = getCookie('createEnvironmentSelectedProject');
					}

					if (selectedProjectValue && !clearProjectSelect) {
						selectProject.value = selectedProjectValue;
					} else if (clearProjectSelect) {
						selectProject.value = '';
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
				$('#form-environment-create').find('button[type="submit"]').prop('disabled', false);
			},
			error: function (xhr, status, error) {
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });
				$('#form-environment-create').find('button[type="submit"]').prop('disabled', false);

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

$('body').on('click', '.btn-edit-mapping-profile', function () {
	const mappingProfileId = $(this).data('mapping-profile');
	const mappingProfileHistoryId = $(this).data('mapping-profile-version');
	editMappingProfile(mappingProfileId, mappingProfileHistoryId);
});

async function editMappingProfile(mappingProfileId, mappingProfileHistoryId) {
	mappingHistoryData = [];
	isMappingProfilePage = true;
	itemProperties = [];
	currentItemProperty = {};
	currentItemPropertyEnable = 0;
	propsValidationRowCounter = 1;
	propsFormatRowCounter = 1;
	nodeDataArray = [];
	linkDataArray = [];
	inbound_nodes = [];
	inbound_linkdata = [];
	outbound_nodes = [];
	outbound_linkdata = [];
	myDiagram.model = new go.GraphLinksModel([], []);
	myDiagram.clear();

	$('#mapping-formula-props #props-display-value').val('');
	$('#mapping-formula-props #props-display-default-value').val('');
	$('#mapping-formula-props #props-display-global-variable-name').val('');
	$('#mapping-formula-props #props-general-item').html('');
	$('#mapping-formula-props .table-section-linked-items-rows').remove();
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
	$('#inboundFormatData').val('');
	$('#outboundFormatData').val('');
	clearErrors();

	mappingProfileHistory = mappingProfileHistoryId;
	$('.overlay, body').removeClass('loaded');
	$('.overlay').css({ 'display': 'block' });

	await $.ajax({
		url: '/template/mapping-profiles/get/' + mappingProfileId + '/' + mappingProfileHistoryId,
		method: 'GET',
		success: async function (response) {
			if (response.status === 1) {
				const data = response?.data;
				// const selectProject = $('#select-project');
				const selectInboundFormat = $('#select-inbound-format');
				const selectOutboundFormat = $('#select-outbound-format');

				$('#mapping-profile-id').val(data._id);
				$('#mapping-profile-history-id').val(mappingProfileHistoryId);
				$('#mapping-profile-name').val(data.name);
				$('#version').val(data?.version || '');
				$('#mapping-profile-description').val(data?.description || '');

				const selectCompany = $('#select-mapping-company');
				selectCompany.data('programmaticChange', false);
				selectCompany.val(data.companyId).trigger('change');

				await getProjectsMappingProfile(data.companyId, data.projectId);

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
						newCols += '<td class="col-sm-3 autocomplete"><input type="text" name="filter[][original]" class="form-control border-0 inboound-autocomplete-filter" id="filteroriginal_' + i + '" value="' + data.filters[i].original.replace(/"/g, '&quot;') + '"/></td>';
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
						newCols += '<td class="col-sm-2 autocomplete"><input type="text" name="filter[][column]" class="form-control border-0 inboound-autocomplete-filter" id="filtercolumn_' + i + '" value="' + data.filters[i].column.replace(/"/g, '&quot;') + '"/></td>';

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
					populateHistoryTable('#publish-history', data, 'history', false);
					populateHistoryTable('#version-history', data, 'version', true);
					mappingHistoryData = data
				}

				// $('#update-mapping-profile').show();
				// $('#create-mapping-profile').text('Publish to Existing Version');
				// $('#mapping-profiles-modal').modal('show');
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

async function handleMappingProfileFormSubmit() {
	$('#form-mapping-profile-create').find('button[type="submit"]').prop('disabled', true);

	$('.overlay, body').removeClass('loaded');
	$('.overlay').css({ 'display': 'block' });

	let filters = [];
	$('#filter-table').find('tbody tr').each(function (i) {
		let filter = {};
		let $fieldset = $(this);

		filter.logical = $('select:eq(0) option:selected', $fieldset).val();
		filter.original = $('input:text:eq(0)', $fieldset).val();
		filter.operations = $('select:eq(1) option:selected', $fieldset).val();
		filter.column = $('input:text:eq(1)', $fieldset).val();

		filters.push(filter);
	});

	if (currentItemPropertyEnable == 1) {
		let itemProperty = {},
			display = {},
			visibility = {},
			validation = {},
			format = {},
			itemPropertyKey = '',
			validationAdditonalRules = [],
			formatAdditonalRules = [];

		itemProperty = currentItemProperty;

		display.value = $('#mapping-formula-props #props-display-value').val();
		display.defaultValue = $('#mapping-formula-props #props-display-default-value').val();
		display.global = $('#mapping-formula-props #props-display-global-variable-name').val();
		itemProperty['display'] = display;

		visibility.hiddenWhenEmpty = $("#mapping-formula-props #props-is-hidden-empty option:selected").val();
		var hiddenRules = [];
		$("#prop-hidden-rules-table").find('tbody tr').each(function (i) {
			var hiddenRule = {};
			var $fieldset = $(this);
			hiddenRule.logical = $('select:eq(0) option:selected', $fieldset).val();
			hiddenRule.original = $('input:text:eq(0)', $fieldset).val();
			hiddenRule.operations = $('select:eq(1) option:selected', $fieldset).val();
			hiddenRule.column = $('input:text:eq(1)', $fieldset).val();
			hiddenRules.push(hiddenRule);
		});
		visibility.hidden_rules = hiddenRules;
		itemProperty["visibility"] = visibility;

		validation.isRequired = $('#mapping-formula-props #props-validation-is-required').val();
		validation.valueMustbe = $('#mapping-formula-props #props-validation-value-must-be').val();

		$('#prop-validation-additional-rules-table').find('tbody tr').each(function (i) {
			let validationAdditonalRule = {};
			let $fieldset = $(this);

			validationAdditonalRule.logical = $('select:eq(0) option:selected', $fieldset).val();
			validationAdditonalRule.original = $('input:text:eq(0)', $fieldset).val();
			validationAdditonalRule.operations = $('select:eq(1) option:selected', $fieldset).val();
			validationAdditonalRule.column = $('input:text:eq(1)', $fieldset).val();
			validationAdditonalRule.then = $('select:eq(2) option:selected', $fieldset).val();
			validationAdditonalRule.formula = $('input:text:eq(2)', $fieldset).val();

			validationAdditonalRules.push(validationAdditonalRule);
		});

		validation.additonal_rules = validationAdditonalRules;
		itemProperty['validation'] = validation;

		format.trim = $('#mapping-formula-props #props-format-is-trim').val();
		format.enableRounding = $('#mapping-formula-props #props-format-enable-rounding').val();
		format.enabeDecimal = $('#mapping-formula-props #props-format-enable-decimal').val();
		format.decimal = $('#mapping-formula-props #props-format-decimal').val();

		$('#prop-format-additional-rules-table').find('tbody tr').each(function (i) {
			let formatAdditonalRule = {};
			let $fieldset = $(this);

			formatAdditonalRule.name = $('select:eq(0) option:selected', $fieldset).val();

			if (formatAdditonalRule.name == 'TRIM' || formatAdditonalRule.name == 'LEFT TRIM' || formatAdditonalRule.name == 'RIGHT TRIM') {
				formatAdditonalRule.formulato = $('select:eq(1) option:selected', $fieldset).val();
			} else {
				formatAdditonalRule.formulato = $('input:text:eq(0)', $fieldset).val();
			}

			if (formatAdditonalRule.name == 'REPLACE' || formatAdditonalRule.name == 'SUBSTRING' || formatAdditonalRule.name == "To DATE") {
				formatAdditonalRule.formulatonew = $('input:text:eq(1)', $fieldset).val();
			} else {
				formatAdditonalRule.formulatonew = '';
			}

			formatAdditonalRules.push(formatAdditonalRule);
		});

		format.additonal_rules = formatAdditonalRules;
		itemProperty['format'] = format;

		itemPropertyKey = itemProperty.general.itemKey;

		if (itemProperties.length > 0) {
			for (let i = 0; i < itemProperties.length; i++) {
				if (itemProperties[i].general.itemKey == itemPropertyKey) {
					itemProperties[i] = itemProperty;
					itemPropertyKey = '';
				}
			}
		}

		if (itemPropertyKey != '') {
			itemProperties.push(itemProperty);
		}
	}

	const data = {
		companyId: $('#select-mapping-company').val(),
		projectId: $('#select-project').val() == ' ' ? null : $('#select-project').val(),
		mappingProfileName: $('#mapping-profile-name').val(),
		version: $('#version').val(),
		mappingProfileDescription: $('#mapping-profile-description').val(),
		returnUrl: $('#return-url').val(),
		sendCollectionOnebyOne: $('#send-collection-one-by-one').is(':checked') ? 1 : 0,
		collectionsName: $('#collections-name').val(),
		filters,
		inboundFormat: $('#select-inbound-format').val(),
		outboundFormat: $('#select-outbound-format').val(),
		inboundFormatData: $('#inboundFormatData').val(),
		outboundFormatData: $('#outboundFormatData').val(),
		mappingData: $('#mySavedModel2').val(),
		properties: itemProperties,
		isActive: $('#is-active').is(':checked') ? 1 : 0,
		companyCode: mappingProfileCompanyCode,
		isNewMappingProfile
	};

	const id = $('#mapping-profile-id').val();
	const apiUrl = (!id) ? '/template/mapping-profiles/create' : `/template/mapping-profiles/update/${id}/${mappingProfileHistory}`;
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

				if (!id && isMappingProfilePage) window.location.href = '/template/mapping-profiles';
				if (id && isMappingProfilePage) window.location.href = `/template/mapping-profiles/edit/${id}/${response.id}`;
				if (!isMappingProfilePage) {
					updateMappingProfileOption(id, response.id);
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
			$('#form-mapping-profile-create').find('button[type="submit"]').prop('disabled', false);
		},
		error: function (xhr, status, error) {
			$('.overlay, body').addClass('loaded');
			$('.overlay').css({ 'display': 'none' });
			$('#form-mapping-profile-create').find('button[type="submit"]').prop('disabled', false);

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

$('#mapping-profiles-modal').on('hidden.bs.modal', function () {
	clearForm(this);
});

$('body').on('click', '.btn-switch-history', function () {
	const mappingProfileId = $(this).attr('data-mapping-profile-id');
	const mappingProfileHistoryId = $(this).attr('data-mapping-profile-history-id');
	const version = $(this).attr('data-version');
	editMappingProfile(mappingProfileId, mappingProfileHistoryId);
	$('#publish-version-history-model-slide-in').modal('hide')
});

$('body').on('click', '.btn-switch-version', function () {
	const mappingProfileId = $(this).attr('data-mapping-profile-id');
	const mappingProfileHistoryId = $(this).attr('data-mapping-profile-history-id');
	const version = $(this).attr('data-version');

	Swal.fire({
		title: 'Are you sure?',
		text: 'You want to switch mapping profile version?',
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

			$.ajax({
				url: '/template/mapping-profiles/version/' + mappingProfileId + '/' + mappingProfileHistoryId,
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ mappingProfileId, mappingProfileHistoryId, version }),
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

						setTimeout(function () {
							if (isMappingProfilePage) {
								history.replaceState(null, '', `/template/mapping-profiles/edit/${mappingProfileId}/${mappingProfileHistoryId}`);
								location.reload();
							} else {
								editMappingProfile(mappingProfileId, mappingProfileHistoryId);
								$('#publish-version-history-model-slide-in').modal('hide');
							}
						}, 1200);
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

$('body').on('click', '#cleanup-inbound-properties-btn', function () {
	Swal.fire({
		title: 'Are you sure?',
		text: 'Want to cleanup all properties?',
		icon: 'warning',
		showCancelButton: true,
		confirmButtonColor: '#DD6B55',
		confirmButtonText: 'Yes, delete it!',
	}).then(function (isConfirm) {
		if (isConfirm.value) {
			itemProperties = [];
			currentItemProperty = {};
			currentItemPropertyEnable = 0;
			propsHiddenRowCounter = 1;
			propsValidationRowCounter = 1;
			propsFormatRowCounter = 1;

			$('#mapping-formula-props #props-general-item').html('');
			$('#mapping-formula-props .table-section-linked-items-rows').remove();
			$('#mapping-formula-props #props-display-value').val('');
			$('#mapping-formula-props #props-display-default-value').val('');
			$('#mapping-formula-props #props-display-global-variable-name').val('');

			$('#props-validation-is-required').val('FALSE').trigger('change');
			$('#props-validation-value-must-be').val("").trigger('change');
			$('#mapping-formula-props #props-is-hidden-empty > option[value="FALSE"]').attr('selected', 'selected').prop('selected', true);
			$("table.prop-hidden-rules-table tbody").html("");
			$('#prop-hidden-rules-btn-add-row').trigger('click');

			$('#prop-validation-additional-rules-table tbody').html('');
			$('#prop-validation-additional-rules-btn-add-row').trigger('click');

			$('#props-format-is-trim').val('FALSE').trigger('change');
			$('#props-format-enable-rounding').val('FALSE').trigger('change');
			$('#props-format-enable-decimal').val('FALSE').trigger('change');
			$('#mapping-formula-props #props-format-decimal').val('2');

			$('#prop-format-additional-rules-table tbody').html('');
			$('#prop-format-additional-rules-btn-add-row').trigger('click');
		}
	});
});

$('body').on('click', '#filter-btn-add-row', function () {
	let newRow = '<tr>';
	let newCols = '';

	newCols += '<td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="filter[][logical]"><option value="AND">AND</option><option value="OR">OR</option></select></td>';
	newCols += '<td class="col-sm-3 autocomplete"><input type="text" name="filter[][original]" class="form-control border-0 inboound-autocomplete-filter" id="filteroriginal_' + filterCounter + '"/></td>';
	newCols += '<td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="filter[][operations]"><option value="==">=</option><option value=">">></option><option value=">=">>=</option><option value="<"><</option><option value="<="><=</option><option value="<>"><></option><option value="Contains">Contains</option></select></td>';
	newCols += '<td class="col-sm-2 autocomplete"><input type="text" name="filter[][column]" class="form-control border-0 inboound-autocomplete-filter" id="filtercolumn_' + filterCounter + '"/></td>';
	newCols += '<td class="col-sm-2 text-center"><a href="javascript:void(0);" type="button" class="filter-btn-del btn-del btn btn-lg modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';

	newRow += newCols;
	newRow += '</tr>';

	$('#filter-table tbody').append(newRow);

	filterCounter++;
});

$('body').on('click', '#filter-table .filter-btn-del', function (event) {
	$(this).closest('tr').remove();
});

$('body').on('click', '#prop-validation-additional-rules-btn-add-row', function () {
	let newRow = '<tr>';
	let newCols = '';

	newCols += '<td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][logical]"><option value="AND">AND</option><option value="OR">OR</option></select></td>';
	newCols += '<td class="col-sm-3 autocomplete"><input type="text" name="propsvalidations[][original]" class="form-control border-0 autocompleteformula" id="proporiginal_' + propsValidationRowCounter + '"/></td>';
	newCols += '<td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][operations]"><option value="==">=</option><option value=">">></option><option value=">=">>=</option><option value="<"><</option><option value="<="><=</option><option value="<>"><></option><option value="Contains">Contains</option></select></td>';
	newCols += '<td class="col-sm-2 autocomplete"><input type="text" name="propsvalidations[][column]" class="form-control border-0 autocompleteformula" id="propcolumn_' + propsValidationRowCounter + '"/></td>';
	newCols += '<td class="col-sm-2"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][then]"><option value="STOP">STOP</option></select></td>';
	newCols += '<td class="col-sm-2 autocomplete"><input type="text" name="propsvalidations[][formula]" class="form-control border-0 autocompleteformula" id="propformula_' + propsValidationRowCounter + '"/></td>';
	newCols += '<td class="col-sm-2 text-center"><a href="javascript:void(0);" type="button" class="prop-validation-additional-rules-btn-del btn btn-lg btn-del modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';

	newRow += newCols;
	newRow += '</tr>';

	$('#prop-validation-additional-rules-table tbody').append(newRow);

	propsValidationRowCounter++;
});

$('body').on('click', '#prop-validation-additional-rules-table .prop-validation-additional-rules-btn-del', function (event) {
	$(this).closest('tr').remove();
});

$('body').on('click', '#prop-format-additional-rules-btn-add-row', function () {
	let newRow = '<tr id="prop-format-additional-rules-table-row-' + propsFormatRowCounter + '">';
	let newCols = '';

	newCols += '<td class="col-sm-1 format-rules-icon text-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-code font-medium-2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></td>';
	newCols += '<td class="col-sm-3"><select class="select-dropdown form-control form-control-lg format-additional-rules-name" name="formatrules[][name]" id="format-additional-rules-name-' + propsFormatRowCounter + '"><option value="REPLACE">REPLACE</option><option value="SUBSTRING">SUBSTRING</option><option value="To DATE">To DATE</option><option value="TRIM">TRIM</option><option value="LEFT TRIM">LEFT TRIM</option><option value="RIGHT TRIM">RIGHT TRIM</option><option value="ADD WORDS ON THE BEGINING">ADD WORDS ON THE BEGINING</option><option value="ADD WORDS ON THE END">ADD WORDS ON THE END</option><option value="FORMULA TO">FORMULA TO</option></select></td>';
	newCols += '<td class="col-sm-3 prop-format-additional-rules-table-row-formulato autocomplete"><input type="text" name="formatrules[][formulato]" class="form-control border-0 autocompleteformula" id="format-additional-rules-formulato-' + propsFormatRowCounter + '"/><select class="select-dropdown form-control form-control-lg" name="formatrules[][formulatodropdown]" id="format-additional-rules-formulatodropdown-' + propsFormatRowCounter + '" style="display: none;"><option value="FALSE">FALSE</option><option value="TRUE">TRUE</option></select></td>';
	newCols += '<td class="col-sm-3 prop-format-additional-rules-table-row-formulatonew"><input type="text" name="formatrules[][formulatonew]" class="form-control border-0" id="format-additional-rules-formulatonew-' + propsFormatRowCounter + '"/></td>';
	newCols += '<td class="col-sm-1 text-center"><a href="javascript:void(0);" type="button" class="prop-format-additional-rules-btn-del btn btn-lg btn-del modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';

	newRow += newCols;
	newRow += '</tr>';

	$('#prop-format-additional-rules-table tbody').append(newRow);

	propsFormatRowCounter++;
});

$('body').on('click', '#prop-format-additional-rules-table .prop-format-additional-rules-btn-del', function (event) {
	$(this).closest('tr').remove();
});

$("body").on("click", "#prop-hidden-rules-btn-add-row", function () {
	var newRow = "<tr>";
	var cols = "";
	cols += '<td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][logical]"><option value="AND">AND</option><option value="OR">OR</option></select></td>';
	cols += '<td class="col-sm-3 autocomplete"><input type="text" name="propsvalidations[][original]" class="form-control border-0 autocompleteformula" id="prophiddenoriginal_ ' + propsHiddenRowCounter + '"/></td>';
	cols += '<td class="col-sm-2 operations-select"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][operations]"><option value="==">=</option><option value=">">></option><option value=">=">>=</option><option value="<"><</option><option value="<="><=</option><option value="<>"><></option><option value="Contains">Contains</option></select></td>';
	cols += '<td class="col-sm-3 autocomplete"><input type="text" name="propsvalidations[][column]" class="form-control border-0 autocompleteformula" id="prophiddencolumn_' + propsHiddenRowCounter + '"/></td>';
	cols += '<td class="col-sm-2" style="text-align: -webkit-center;"><a href="javascript:void(0);" type="button" class="prop-hidden-rules-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';
	newRow += cols;
	newRow += "</tr>";
	$("table.prop-hidden-rules-table tbody").append(newRow);
	propsHiddenRowCounter++;
});

$("body table.prop-hidden-rules-table").on("click", ".prop-hidden-rules-btn-del", function (event) {
	$(this).closest("tr").remove();
});

$('body').on('click', '#prop-validation-additional-rules-btn-save, #prop-format-additional-rules-btn-save, #prop-hidden-rules-btn-save', function (event) {
	event.preventDefault();
	let itemProperty = {},
		display = {},
		visibility = {},
		validation = {},
		format = {},
		itemPropertyKey = '',
		validationAdditonalRules = [],
		formatAdditonalRules = [];

	let itemKey = propsCurrentItemKey;
	let general = {};

	general.itemName = $('#props-general-item').html();
	general.itemKey = itemKey.replace('=', '');

	currentItemProperty = {};
	currentItemProperty['general'] = general;

	itemProperty = currentItemProperty;

	display.value = $('#mapping-formula-props #props-display-value').val();
	display.defaultValue = $('#mapping-formula-props #props-display-default-value').val();
	display.global = $('#mapping-formula-props #props-display-global-variable-name').val();
	itemProperty['display'] = display;

	visibility.hiddenWhenEmpty = $("#mapping-formula-props #props-is-hidden-empty option:selected").val();
	var hiddenRules = [];
	$("#prop-hidden-rules-table").find('tbody tr').each(function (i) {
		var hiddenRule = {};
		var $fieldset = $(this);
		hiddenRule.logical = $('select:eq(0) option:selected', $fieldset).val();
		hiddenRule.original = $('input:text:eq(0)', $fieldset).val();
		hiddenRule.operations = $('select:eq(1) option:selected', $fieldset).val();
		hiddenRule.column = $('input:text:eq(1)', $fieldset).val();
		hiddenRules.push(hiddenRule);
	});
	visibility.hidden_rules = hiddenRules;
	itemProperty["visibility"] = visibility;

	validation.isRequired = $('#mapping-formula-props #props-validation-is-required').val();
	validation.valueMustbe = $('#mapping-formula-props #props-validation-value-must-be').val();


	$('#prop-validation-additional-rules-table').find('tbody tr').each(function (i) {
		let validationAdditonalRule = {};
		let $fieldset = $(this);

		validationAdditonalRule.logical = $('select:eq(0) option:selected', $fieldset).val();
		validationAdditonalRule.original = $('input:text:eq(0)', $fieldset).val();
		validationAdditonalRule.operations = $('select:eq(1) option:selected', $fieldset).val();
		validationAdditonalRule.column = $('input:text:eq(1)', $fieldset).val();
		validationAdditonalRule.then = $('select:eq(2) option:selected', $fieldset).val();
		validationAdditonalRule.formula = $('input:text:eq(2)', $fieldset).val();
		validationAdditonalRules.push(validationAdditonalRule);
	});

	validation.additonal_rules = validationAdditonalRules;
	itemProperty['validation'] = validation;

	format.trim = $('#mapping-formula-props #props-format-is-trim').val();
	format.enableRounding = $('#mapping-formula-props #props-format-enable-rounding').val();
	format.enabeDecimal = $('#mapping-formula-props #props-format-enable-decimal').val();
	format.decimal = $('#mapping-formula-props #props-format-decimal').val();

	$('#prop-format-additional-rules-table').find('tbody tr').each(function (i) {
		let formatAdditonalRule = {};
		let $fieldset = $(this);

		formatAdditonalRule.name = $('select:eq(0) option:selected', $fieldset).val();

		if (formatAdditonalRule.name == 'TRIM' || formatAdditonalRule.name == 'LEFT TRIM' || formatAdditonalRule.name == 'RIGHT TRIM') {
			formatAdditonalRule.formulato = $('select:eq(0) option:selected', $fieldset).val();
		} else {
			formatAdditonalRule.formulato = $('input:text:eq(0)', $fieldset).val();
		}

		if (formatAdditonalRule.name == 'REPLACE' || formatAdditonalRule.name == 'SUBSTRING' || formatAdditonalRule.name == "To DATE") {
			formatAdditonalRule.formulatonew = $('input:text:eq(1)', $fieldset).val();
		} else {
			formatAdditonalRule.formulatonew = '';
		}

		formatAdditonalRules.push(formatAdditonalRule);
	});

	format.additonal_rules = formatAdditonalRules;
	itemProperty['format'] = format;

	itemPropertyKey = itemProperty.general.itemKey;

	if (itemProperties.length > 0) {
		for (let i = 0; i < itemProperties.length; i++) {
			if (itemProperties[i].general.itemKey == itemPropertyKey) {
				itemProperties[i] = itemProperty;
				itemPropertyKey = '';
			}
		}
	}

	if (itemPropertyKey != '') {
		itemProperties.push(itemProperty);
	}

	currentItemPropertyEnable = 1;

	let propHiddenRulesModal = document.getElementById("props-hidden-rules-modal-btn");
	propHiddenRulesModal.style.display = "none";
	let propValidationAdditionalRulesModal = document.getElementById('props-validation-additional-rules-modal-btn');
	propValidationAdditionalRulesModal.style.display = 'none';
	let propFormatAdditionalRulesModal = document.getElementById('props-format-additional-rules-modal-btn');
	propFormatAdditionalRulesModal.style.display = 'none';
});

// Only inbound autocomplete data - inboundAutocompleteDataArray
// Only outbound autocomplete data - outboundAutocompleteDataArray
// Both inbound and outbound autocomplete data - inOutAutocompleteDataArray
$('body').on('keypress', '.inboound-autocomplete-filter', function () {
	const id = $(this).attr('id');

	autocomplete(document.getElementById(id), inboundAutocompleteDataArray);
});

$('body').on('keypress', '.autocompleteformula', function () {
	const id = $(this).attr('id');

	autocomplete(document.getElementById(id), inOutAutocompleteDataArray);
});

$('body').on('click', '#inboundDataBind, #outboundDataBind', function () {
	const inboundFormat = $('#inboundFormatData').val();
	const outboundFormat = $('#outboundFormatData').val();

	if (inboundFormat != '') {
		const inboundAutocompleteDataArrayReturn = inboundAutocompleteData(inboundFormat);
	}

	if (outboundFormat != '') {
		const outboundAutocompleteDataArrayReturn = outboundAutocompleteData(outboundFormat);
	}

	inOutAutocompleteDataArray = inboundAutocompleteDataArray.concat(outboundAutocompleteDataArray);
});

$('#prop-format-additional-rules-table tbody').sortable({
	items: 'tr',
	cursor: 'pointer',
	axis: 'y',
	dropOnEmpty: false,
	start: function (e, ui) {
		ui.item.addClass('selected');
	},
	stop: function (e, ui) {
		ui.item.removeClass('selected');
		$(this).find('tr').each(function (index) {
		});
	}
});

if ($('#all-inbound-properties-modal').length) {
	let allInboundPropertiesModal = document.getElementById('all-inbound-properties-modal');
	let allInboundPropertiesPopupBtn = document.getElementById('all-inbound-properties-btn');
	let allInboundPropertiesModalClose = document.getElementById('all-inbound-properties-modal-close');

	allInboundPropertiesPopupBtn.onclick = function () {
		let itemPropertiesDataTable = '';

		for (let i = 0; i < itemProperties.length; i++) {
			itemPropertiesDataTable += '<table class="table logical-table table-bordered">';

			if (itemProperties[i].general != undefined) {
				const itemName = (itemProperties[i].general.itemName != undefined) ? itemProperties[i].general.itemName : '';
				itemPropertiesDataTable += '<tr><td colspan="2"><strong>General</strong></td></tr>';
				itemPropertiesDataTable += '<tr><td>Item</td><td>' + itemName + '</td></tr>';
			}

			if (itemProperties[i].display != undefined) {
				const displayValue = (itemProperties[i].display.value != undefined) ? itemProperties[i].display.value : '';
				const defaultValue = (itemProperties[i].display.defaultValue != undefined) ? itemProperties[i].display.defaultValue : '';
				const displayGlobal = (itemProperties[i].display.global != undefined) ? itemProperties[i].display.global : '';
				itemPropertiesDataTable += '<tr><td colspan="2"><strong>Display</strong></td></tr>';
				itemPropertiesDataTable += '<tr><td>Value</td><td>' + displayValue + '</td></tr>';
				itemPropertiesDataTable += '<tr><td>Default Value</td><td>' + defaultValue + '</td></tr>';
				itemPropertiesDataTable += '<tr><td>Global Variable Name</td><td>' + displayGlobal + '</td></tr>';
			}

			if (itemProperties[i].visibility != undefined) {
				const hiddenWhenEmpty = (itemProperties[i].visibility.hiddenWhenEmpty != undefined) ? itemProperties[i].visibility.hiddenWhenEmpty : 'FALSE';
				itemPropertiesDataTable += '<tr><td colspan="2"><strong>Visibility</strong></td></tr>';
				itemPropertiesDataTable += '<tr><td>Hidden When Empty</td><td>' + hiddenWhenEmpty + '</td></tr>';

				itemPropertiesDataTable += '<tr><td colspan="2"><strong>Hidden Rules</strong></td></tr><tr><td colspan="2"><table class="table table-bordered"><thead><tr><td>Logical Operation</td><td>Original Value</td><td>Comparison operations</td><td>Column Value</td></tr></thead><tbody>';

				if (itemProperties[i].visibility.hidden_rules != undefined) {
					const hidden_rules = itemProperties[i].visibility.hidden_rules;
					for (let j = 0; j < hidden_rules.length; j++) {
						itemPropertiesDataTable += '<tr><td>' + hidden_rules[j].logical + '</td><td>' + hidden_rules[j].original + '</td><td>' + hidden_rules[j].operations + '</td><td>' + hidden_rules[j].column + '</td></tr>';
					}
				}

				itemPropertiesDataTable += '</tbody></table></td></tr>';
			}

			if (itemProperties[i].validation != undefined) {
				const isRequired = (itemProperties[i].validation.isRequired != undefined) ? itemProperties[i].validation.isRequired : 'FALSE';
				const valueMustbe = (itemProperties[i].validation.valueMustbe != undefined) ? itemProperties[i].validation.valueMustbe : 'ANY';
				itemPropertiesDataTable += '<tr><td colspan="2"><strong>Validation</strong></td></tr>';
				itemPropertiesDataTable += '<tr><td>isRequired</td><td>' + isRequired + '</td></tr>';
				itemPropertiesDataTable += '<tr><td>valueMustbe</td><td>' + valueMustbe + '</td></tr>';

				itemPropertiesDataTable += '<tr><td colspan="2"><strong>Validation Additional Rules</strong></td></tr><tr><td colspan="2"><table class="table table-bordered"><thead><tr><td>Logical Operation</td><td>Original Value</td><td>Comparison operations</td><td>Column Value</td><td>Then</td><td>Formula/Alerts</td></tr></thead><tbody>';

				if (itemProperties[i].validation.additonal_rules != undefined) {
					const additonal_rules = itemProperties[i].validation.additonal_rules;
					for (let j = 0; j < additonal_rules.length; j++) {
						itemPropertiesDataTable += '<tr><td>' + additonal_rules[j].logical + '</td><td>' + additonal_rules[j].original + '</td><td>' + additonal_rules[j].operations + '</td><td>' + additonal_rules[j].column + '</td><td>' + additonal_rules[j].then + '</td><td>' + additonal_rules[j].formula + '</td></tr>';
					}
				}

				itemPropertiesDataTable += '</tbody></table></td></tr>';
			}

			if (itemProperties[i].format != undefined) {
				const trim = (itemProperties[i].format.trim != undefined) ? itemProperties[i].format.trim : 'FALSE';
				const enableRounding = (itemProperties[i].format.enableRounding != undefined) ? itemProperties[i].format.enableRounding : 'FALSE';
				const enabeDecimal = (itemProperties[i].format.enabeDecimal != undefined) ? itemProperties[i].format.enabeDecimal : 'FALSE';
				const decimal = (itemProperties[i].format.decimal != undefined) ? itemProperties[i].format.decimal : '2';
				itemPropertiesDataTable += '<tr><td colspan="2"><strong>Validation</strong></td></tr>';
				itemPropertiesDataTable += '<tr><td>trim</td><td>' + trim + '</td></tr>';
				itemPropertiesDataTable += '<tr><td>enableRounding</td><td>' + enableRounding + '</td></tr>';
				itemPropertiesDataTable += '<tr><td>enabeDecimal</td><td>' + enabeDecimal + '</td></tr>';
				itemPropertiesDataTable += '<tr><td>decimal</td><td>' + decimal + '</td></tr>';

				itemPropertiesDataTable += '<tr><td colspan="2"><strong>Format Additional Rules</strong></td></tr><tr><td colspan="2"><table class="table table-bordered"><thead><tr><td>Options</td><td></td><td></td></tr></thead><tbody>';

				if (itemProperties[i].format.additonal_rules != undefined) {
					const additonal_rules = itemProperties[i].format.additonal_rules;
					for (let l = 0; l < additonal_rules.length; l++) {
						itemPropertiesDataTable += '<tr><td>' + additonal_rules[l].name + '</td><td>' + additonal_rules[l].formulato + '</td><td>' + additonal_rules[l].formulatonew + '</td></tr>';
					}
				}

				itemPropertiesDataTable += '</tbody></table></td></tr>';
			}

			itemPropertiesDataTable += '</table>';
		}

		$('#all-inbound-properties-modal .properties-data').html(itemPropertiesDataTable);
		allInboundPropertiesModal.style.display = 'flex';
	}

	allInboundPropertiesModalClose.onclick = function () {
		allInboundPropertiesModal.style.display = 'none';
	}

	window.onclick = function (event) {
		if (event.target == allInboundPropertiesModal) {
			allInboundPropertiesModal.style.display = 'none';
		}
	}
}

if ($('#props-validation-additional-rules-modal-btn').length) {
	let propsValidationAdditionalRulesModalBtn = document.getElementById('props-validation-additional-rules-modal-btn');
	let propsValidationAdditionalRulesPopupBtn = document.getElementById('props-validation-additional-rules-popup-btn');
	let propsValidationAdditionalRulesModalClose = document.getElementById('props-validation-additional-rules-modal-close');
	propsValidationAdditionalRulesPopupBtn.onclick = function () {
		propsValidationAdditionalRulesModalBtn.style.display = 'flex';
	}
	propsValidationAdditionalRulesModalClose.onclick = function () {
		propsValidationAdditionalRulesModalBtn.style.display = 'none';
	}
	window.onclick = function (event) {
		if (event.target == propsValidationAdditionalRulesModalBtn) {
			propsValidationAdditionalRulesModalBtn.style.display = 'none';
		}
	}
}

if ($('#props-format-additional-rules-modal-btn').length) {
	let propsFormatAdditionalRulesModalBtn = document.getElementById('props-format-additional-rules-modal-btn');
	let propsFormatAdditionalRulesPopupBtn = document.getElementById('props-format-additional-rules-popup-btn');
	let propsFormatAdditionalRulesModalClose = document.getElementById('props-format-additional-rules-modal-close');
	propsFormatAdditionalRulesPopupBtn.onclick = function () {
		propsFormatAdditionalRulesModalBtn.style.display = 'flex';
	}
	propsFormatAdditionalRulesModalClose.onclick = function () {
		propsFormatAdditionalRulesModalBtn.style.display = 'none';
	}
	window.onclick = function (event) {
		if (event.target == propsFormatAdditionalRulesModalBtn) {
			propsFormatAdditionalRulesModalBtn.style.display = 'none';
		}
	}
}

if ($('#props-hidden-rules-modal-btn').length) {
	let propsHiddenRulesModalBtn = document.getElementById('props-hidden-rules-modal-btn');
	let propsHiddenRulesPopupBtn = document.getElementById('props-hidden-rules-popup-btn');
	let propsHiddenRulesModalClose = document.getElementById('props-hidden-rules-modal-close');
	propsHiddenRulesPopupBtn.onclick = function () {
		propsHiddenRulesModalBtn.style.display = 'flex';
	}
	propsHiddenRulesModalClose.onclick = function () {
		propsHiddenRulesModalBtn.style.display = 'none';
	}
	window.onclick = function (event) {
		if (event.target == propsHiddenRulesModalBtn) {
			propsHiddenRulesModalBtn.style.display = 'none';
		}
	}
}

function clearForm($this) {
	$('#update-mapping-profile').hide();
	$('#create-mapping-profile').text('Create Mapping Profile');
	$($this).find('input, textarea').val('');
	$($this).find('.select2').val(null).trigger('change');
	$($this).find('input[type="checkbox"]:not(#is-active), input[type="radio"]').prop('checked', false);
	$($this).find('#is-active').prop('checked', true);
}

function populateHistoryTable(tableId, data, type = 'history', preventDuplicateVersions = false) {
	const baseUrl = window.location.origin;
	let htmlData = '';
	let versionSet = new Set();

	for (var i = data.histories.length - 1; i >= 0; i--) {
		let currentVersion = data.histories[i].version;

		if (preventDuplicateVersions && versionSet.has(currentVersion)) continue;

		if (preventDuplicateVersions) versionSet.add(currentVersion);

		let newRow = '<tr>';
		let newCols = '';
		let currentVersionText = '';

		if (type === 'version' && data.histories[i].isCurrentVersion) currentVersionText = '<br /><span class="green-color">(Current Version)</span>';

		newCols += `<td>${dateFormat(data.histories[i].createdAt)}${currentVersionText}</td>`;
		newCols += `<td>${currentVersion}</td>`;
		newCols += `<td>${data.histories[i].description}</td>`;

		if (type === 'history') {
			mappingProfileHistory = data.histories[i]._id;
			if (isMappingProfilePage) {
				newCols += `<td><a href="${baseUrl}/template/mapping-profiles/edit/${data._id}/${data.histories[i]._id}" type="button" class="btn btn-primary">View</a></td>`;
			} else {
				newCols += `<td><button type="button" class="btn btn-primary btn-switch-history" data-mapping-profile-id="${data._id}" data-mapping-profile-history-id="${data.histories[i]._id}" data-version="${currentVersion}">View</button></td>`;
			}
		} else if (type === 'version' && !data.histories[i].isCurrentVersion) {
			newCols += `<td><button type="button" class="btn btn-primary btn-switch-version" data-mapping-profile-id="${data._id}" data-mapping-profile-history-id="${data.histories[i]._id}" data-version="${currentVersion}">Switch</button></td>`;
		} else {
			newCols += `<td><span class="green-color">(Current Version)</span></td>`;
		}

		newRow += newCols;
		newRow += '</tr>';
		htmlData += newRow;
	}

	$(tableId + ' tbody').html(htmlData);
}

function inboundAutocompleteData(reqBody) {
	inboundAutocompleteDataArray = [];

	if (reqBody) {
		const isJson = IsJsonString(reqBody);
		if (isJson) {
			let data = JSON.parse(reqBody);
			if (Array.isArray(data)) {
				const arrData = data;
				data = {};
				data['items'] = arrData;
			}

			Object.entries(data).forEach((entry) => {
				const [key, value] = entry;

				let newKey = `@In{${key}}`;
				let normalKey = key;
				let keyCount = 0;

				if (key >= 0) {
				} else {
					keyCount = checkInboundAutocompleteKey(newKey, inboundAutocompleteDataArray);
				}

				if (keyCount > 1) {
					newKey = `@In{${key}${keyCount}}`;
					normalKey = normalKey + keyCount;
				}

				if (key >= 0) {
				} else {
					inboundAutocompleteDataArray.push(newKey);
				}

				if (!Array.isArray(value) && value != null && typeof (value) != 'object') {
				}

				if (!Array.isArray(value) && value != null && typeof (value) == 'object') {
					const newtest = inboundAutocompleteDataArrayObj(normalKey, value, false);
				}

				if (Array.isArray(value) && value != null && typeof (value) == 'object') {
					const newtest = inboundAutocompleteDataArrayObj(normalKey, value, true);
				}
			});

			return inboundAutocompleteDataArray;
		} else {
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({ 'display': 'block' });

			$.ajax({
				url: '/mapping/convert/xml2JSON',
				method: 'POST',
				dataType: 'JSON',
				contentType: 'application/xml',
				data: reqBody,
				header: {
					'content-type': 'application/xml'
				},
				success: function (response) {
					let data = response;
					if (Array.isArray(data)) {
						const arrData = data;
						data = {};
						data['items'] = arrData;
					}

					Object.entries(data).forEach((entry) => {
						const [key, value] = entry;

						let newKey = `@In{${key}}`;
						let normalKey = key;
						let keyCount = 0;

						if (key >= 0) {
						} else {
							keyCount = checkInboundAutocompleteKey(newKey, inboundAutocompleteDataArray);
						}

						if (keyCount > 1) {
							newKey = `@In{${key}${keyCount}}`;
							normalKey = normalKey + keyCount;
						}

						if (key >= 0) {
						} else {
							inboundAutocompleteDataArray.push(newKey);
						}

						if (!Array.isArray(value) && value != null && typeof (value) != 'object') {
						}

						if (!Array.isArray(value) && value != null && typeof (value) == 'object') {
							const newtest = inboundAutocompleteDataArrayObj(normalKey, value, false);
						}

						if (Array.isArray(value) && value != null && typeof (value) == 'object') {
							const newtest = inboundAutocompleteDataArrayObj(normalKey, value, true);
						}
					});

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });

					return inboundAutocompleteDataArray;
				},
				error: function (textStatus, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });

					Swal.fire({
						title: 'Error!',
						text: textStatus?.responseJSON?.message,
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
}

function inboundAutocompleteDataArrayObj(normalKey, reqBody, isArray) {
	const retrun = '';
	const parentKeya = normalKey;

	Object.entries(reqBody).forEach((entry) => {
		const [key, value] = entry;

		let normalKey = parentKeya;
		let newKey = `@In{${normalKey}}`;
		let keyCount = 0;

		if (key >= 0) {
			newKey = `@In{${normalKey}}`;
			normalKey = normalKey;
		} else {
			newKey = `@In{${normalKey}.${key}}`;
			normalKey = `${normalKey}.${key}`;
		}

		if (key >= 0) {
		} else {
			keyCount = checkInboundAutocompleteKey(newKey, inboundAutocompleteDataArray);
		}

		if (keyCount > 1 && !isArray) {
			newKey = `@In{${normalKey}${keyCount}}`;
			normalKey = normalKey + keyCount;
		}

		if (key >= 0) {
		} else {
			if (keyCount > 1 && isArray) {
			} else {
				inboundAutocompleteDataArray.push(newKey);
			}
		}

		if (!Array.isArray(value) && value != null && typeof (value) != 'object') {
		}

		if (!Array.isArray(value) && value != null && typeof (value) == 'object') {
			const newtest = inboundAutocompleteDataArrayObj(normalKey, value, false);
		}

		if (Array.isArray(value) && value != null && typeof (value) == 'object') {
			const newtest = inboundAutocompleteDataArrayObj(normalKey, value, true);
		}
	});

	return retrun;
}

function outboundAutocompleteData(reqBody) {
	outboundAutocompleteDataArray = [];

	if (reqBody) {
		const isJson = IsJsonString(reqBody);
		if (isJson) {
			let data = JSON.parse(reqBody);
			if (Array.isArray(data)) {
				const arrData = data;
				data = {};
				data['items'] = arrData;
			}

			Object.entries(data).forEach((entry) => {
				const [key, value] = entry;

				let newKey = `@Out{${key}}`;
				let normalKey = key;
				let keyCount = 0;

				if (key >= 0) {
				} else {
					keyCount = checkInboundAutocompleteKey(newKey, outboundAutocompleteDataArray);
				}

				if (keyCount > 1) {
					newKey = `@Out{${key}${keyCount}}`;
					normalKey = normalKey + keyCount;
				}

				if (key >= 0) {
				} else {
					outboundAutocompleteDataArray.push(newKey);
				}

				if (!Array.isArray(value) && value != null && typeof (value) != 'object') {
				}

				if (!Array.isArray(value) && value != null && typeof (value) == 'object') {
					const newtest = outboundAutocompleteDataArrayObj(normalKey, value, false);
				}

				if (Array.isArray(value) && value != null && typeof (value) == 'object') {
					const newtest = outboundAutocompleteDataArrayObj(normalKey, value, true);
				}
			});

			return outboundAutocompleteDataArray;
		} else {
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({ 'display': 'block' });

			$.ajax({
				url: '/mapping/convert/xml2JSON',
				method: 'POST',
				dataType: 'JSON',
				contentType: 'application/xml',
				data: reqBody,
				header: {
					'content-type': 'application/xml'
				},
				success: function (response) {
					let data = response;
					if (Array.isArray(data)) {
						const arrData = data;
						data = {};
						data['items'] = arrData;
					}

					Object.entries(data).forEach((entry) => {
						const [key, value] = entry;

						let newKey = `@Out{${key}}`;
						let normalKey = key;
						let keyCount = 0;

						if (key >= 0) {
						} else {
							keyCount = checkInboundAutocompleteKey(newKey, outboundAutocompleteDataArray);
						}

						if (keyCount > 1) {
							newKey = `@Out{${key}${keyCount}}`;
							normalKey = normalKey + keyCount;
						}

						if (key >= 0) {
						} else {
							outboundAutocompleteDataArray.push(newKey);
						}

						if (!Array.isArray(value) && value != null && typeof (value) != 'object') {
						}

						if (!Array.isArray(value) && value != null && typeof (value) == 'object') {
							const newtest = outboundAutocompleteDataArrayObj(normalKey, value, false);
						}

						if (Array.isArray(value) && value != null && typeof (value) == 'object') {
							const newtest = outboundAutocompleteDataArrayObj(normalKey, value, true);
						}
					});

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });

					return outboundAutocompleteDataArray;
				},
				error: function (textStatus, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });

					Swal.fire({
						title: 'Error!',
						text: textStatus?.responseJSON?.message,
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
}

function outboundAutocompleteDataArrayObj(normalKey, reqBody, isArray) {
	const retrun = '';
	const parentKeya = normalKey;

	Object.entries(reqBody).forEach((entry) => {
		const [key, value] = entry;

		let normalKey = parentKeya;
		let newKey = `@Out{${normalKey}}`;
		let key_count = 0;

		if (key >= 0) {
			newKey = `@Out{${normalKey}}`;
			normalKey = normalKey;
		} else {
			newKey = `@Out{${normalKey}.${key}}`;
			normalKey = `${normalKey}.${key}`;
		}

		if (key >= 0) {
		} else {
			key_count = checkInboundAutocompleteKey(newKey, outboundAutocompleteDataArray);
		}

		if (key_count > 1 && !isArray) {
			newKey = `@Out{${normalKey}${key_count}}`;
			normalKey = normalKey + key_count;
		}

		if (key >= 0) {
		} else {
			if (key_count > 1 && isArray) {
			} else {
				outboundAutocompleteDataArray.push(newKey);
			}
		}

		if (!Array.isArray(value) && value != null && typeof (value) == 'object') {
			const newtest = outboundAutocompleteDataArrayObj(normalKey, value, false);
		}

		if (Array.isArray(value) && value != null && typeof (value) == 'object') {
			const newtest = outboundAutocompleteDataArrayObj(normalKey, value, true);
		}
	});

	return retrun;
}

function checkInboundAutocompleteKey(key, dataArray) {
	let j = 1;

	for (let i = 0; i < dataArray.length; i++) {
		let newKey = (j == 1) ? key : key + j;
		if (dataArray[i] == newKey) {
			j++;
		}
	}

	return j;
}

function autocomplete(inp, arr) {
	let currentFocus;
	let newValue = 0;
	let fullValue = '';
	inp.addEventListener('keyup', function (e) {
		if ((e.keyCode == 8 || e.keyCode >= 48 && e.keyCode <= 90) || (e.keyCode >= 96 && e.keyCode <= 105) || (e.keyCode >= 186 && e.keyCode <= 222)) {
			if (e.keyCode == 8) {
				onlyInboundI = 0; onlyInboundN = 0;
			}

			let a, b, i, val = inp.value;
			if (newValue == 0 && e.key == '@') {
				val = e.key;
				newValue = 1;
			}

			if (val.includes('@')) {
				const pieces = val.split('@');
				if (pieces[pieces.length - 1] != undefined) {
					val = `@${pieces[pieces.length - 1]}`;
				} else {
					val = '@';
				}
			}

			closeAllLists();
			if (!val) { return false; }
			currentFocus = -1;

			a = document.createElement('DIV');
			a.setAttribute('id', this.id + 'autocomplete-list');
			a.setAttribute('class', 'autocomplete-items');

			this.parentNode.appendChild(a);

			for (i = 0; i < arr.length; i++) {
				if (arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
					b = document.createElement('DIV');
					b.innerHTML = '<strong>' + arr[i].substr(0, val.length) + '</strong>';
					b.innerHTML += arr[i].substr(val.length);
					b.innerHTML += '<input type="hidden" value="' + arr[i] + '">';
					b.addEventListener('click', function (e) {
						const pieces = val.split('@');
						let values = '';

						if (pieces != undefined) {
							for (let j = 0; j < pieces.length - 1; j++) {
								if (pieces[j] != '') {
									if (pieces[j].startsWith('In{')) {
										values += `@${pieces[j]}`;
									} else {
										values += pieces[j];
									}
								}
							}
						}

						inp.value = values + this.getElementsByTagName('input')[0].value;
						fullValue = inp.value;
						newValue = 0;
						closeAllLists();
					});
					a.appendChild(b);
				}
			}
		} else {
			if (e.keyCode == 46) {
				newValue = 0;
			}
		}
	});

	inp.addEventListener('keydown', function (e) {
		let x = document.getElementById(this.id + 'autocomplete-list');
		if (x) x = x.getElementsByTagName('div');
		if (e.keyCode == 40) {
			currentFocus++;
			addActive(x);
		} else if (e.keyCode == 38) {
			currentFocus--;
			addActive(x);
		} else if (e.keyCode == 13) {
			e.preventDefault();
			if (currentFocus > -1) {
				if (x) x[currentFocus].click();
			}
		}
	});

	function addActive(x) {
		if (!x) return false;
		removeActive(x);
		if (currentFocus >= x.length) currentFocus = 0;
		if (currentFocus < 0) currentFocus = (x.length - 1);
		x[currentFocus].classList.add('autocomplete-active');
	}

	function removeActive(x) {
		for (let i = 0; i < x.length; i++) {
			x[i].classList.remove('autocomplete-active');
		}
	}

	function closeAllLists(elmnt) {
		let x = document.getElementsByClassName('autocomplete-items');
		for (let i = 0; i < x.length; i++) {
			if (elmnt != x[i] && elmnt != inp) {
				x[i].parentNode.removeChild(x[i]);
			}
		}
	}

	document.addEventListener('click', function (e) {
		closeAllLists(e.target);
	});
}

function IsJsonString(str) {
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
}