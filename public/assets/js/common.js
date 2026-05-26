let formValidator = '';
let companyListCommon = [];
let projectListCommon = [];


if (EnableGimaEnv == true) {
	setInterval(intervalFunc, 500);
}

$(window).on('load', function () {
	if (feather) {
		feather.replace({ width: 14, height: 14 });
	}
});

const url = window.location.pathname,
	urlRegExp = new RegExp(url.replace(/\/$/, '') + '$');
$('#main-menu-navigation li a').each(function () {
	if (urlRegExp.test(this.href.replace(/\/$/, ''))) {
		$(this).parents('.nav-item').addClass('sidebar-group-active open')
		$(this).addClass('active');
	}
});

document.addEventListener("DOMContentLoaded", function () {
	function updateActiveNavItem() {
		const currentUrl = window.location.pathname;
		const navItems = document.querySelectorAll('.navigation-main .nav-item > a');

		navItems.forEach(link => {
			const href = link.getAttribute('href');

			// Check for parent menu item with children
			if (href === "javascript:void(0);") {
				const navItemsChild = link.closest('.nav-item').querySelectorAll('.menu-content > li > a');

				let isChildActive = false;

				navItemsChild.forEach(childLink => {
					const hrefChild = childLink.getAttribute('href');

					if (currentUrl === hrefChild || currentUrl === hrefChild + '/') {
						childLink.classList.add('active');
						isChildActive = true;
					} else {
						childLink.classList.remove('active');
					}
				});

				const parentMenu = link.closest('.nav-item');
				if (isChildActive) {
					parentMenu.classList.add('open');
				} else {
					parentMenu.classList.remove('open');
				}

			} else {
				if (currentUrl === href || currentUrl === href + '/') {
					link.classList.add('active');
					const parentMenu = link.closest('.nav-item');
					if (parentMenu && parentMenu.querySelector('.menu-content')) {
						parentMenu.classList.add('open');
					}
				} else {
					link.classList.remove('active');
					const parentMenu = link.closest('.nav-item');
					if (parentMenu && parentMenu.querySelector('.menu-content')) {
						parentMenu.classList.remove('open');
					}
				}
			}
		});
	}

	updateActiveNavItem();
	document.getElementById("current-year").textContent = new Date().getFullYear();

	function getCookie(name) {
		const value = `; ${document.cookie}`;
		const parts = value.split(`; ${name}=`);
		if (parts.length === 2) return parts.pop().split(';').shift();
	}

	const token = getCookie('Token');
	if (token) {
		try {
			const payloadBase64 = token.split('.')[1];
			const decodedPayload = JSON.parse(atob(payloadBase64));
			const username = decodedPayload.username || 'Unknown User';
			const apiUrl = '/users/single-user';
			const method = 'POST';
			let user_name = '';

			$.ajax({
				url: apiUrl,
				method: method,
				contentType: 'application/json',
				data: JSON.stringify({ id: username, companyCode: decodedPayload.company_code }),
				success: function (response) {
					if (response.status === 1) {
						const firstName = response.data?.first_name || '';
						const lastName = response.data?.last_name || '';
						const profileImage = response.data?.profile_image || '';
						const initials = `${firstName.charAt(0).toUpperCase()}${lastName.charAt(0).toUpperCase()}`;
						const user_name = `${firstName} ${lastName}`;
						const userNameElement = document.querySelector(".user-name");
						if (userNameElement) {
							userNameElement.textContent = user_name;
						}

						const userLogoBox = document.querySelector(".user-logo-box");
						if (userLogoBox) {
							userLogoBox.innerHTML = '';

							if (profileImage) {
								const imgElement = document.createElement('img');
								userLogoBox.style.lin;
								imgElement.src = profileImage;
								imgElement.alt = 'Profile Image';
								imgElement.className = 'profile-image';
								userLogoBox.appendChild(imgElement);
								userLogoBox.style.boxShadow = 'none';
								userLogoBox.style.lineHeight = 'initial';
							} else {
								userLogoBox.textContent = initials;
							}
						}
					}
				},
				error: function (xhr, status, error) {
					const userNameElement = document.querySelector(".user-name");
					if (userNameElement) {
						userNameElement.textContent = "Unknown User";
					}

					const userLogoBox = document.querySelector(".user-logo-box");
					if (userLogoBox) {
						userLogoBox.textContent = "UU";
					}
				}
			});
		} catch (error) {
			console.error('Failed to decode token:', error.message);
		}
	} else {
		console.error('Token not found in cookies.');
	}
});

$(document).ready(function () {
	$('#dropdown-brand').click(function () {
		$(this).siblings().find('.project-name').each(function () {
			var $this = $(this);
			var $dropdownItem = $this.closest('.dropdown-item-brand');
			var $projectContent = $this.closest('.project-content');
			if ($this.hasClass('active')) {
				$dropdownItem.addClass('active').siblings().removeClass('active');
				$projectContent.addClass('active').siblings().removeClass('active');
				$('.project-content').each(function () {
					if ($(this).hasClass('active')) {
						var projectId = $(this).attr('id');
						$('.dropdown-wrapper-box .dropdown-item').each(function () {
							if ($(this).attr('data-box') === projectId) {
								$(this).addClass('active').siblings().removeClass('active');
							}
						});
					}
				});
			}
		});
		$(this).siblings().find('.project-name').each(function () {
			if ($(this).hasClass('active')) {
				$('.mb-project-content').removeClass('active');
				$(this).closest('.mb-project-content').addClass('active');
				$(this).closest('.dropdown-item-brand').addClass('active').siblings().removeClass('active');
			}
		});
	});

	$('[data-toggle="tooltip"]').tooltip();
	$('[data-toggle="tooltip"]').on('click', function () {
		if ($(this).data('bs.tooltip')) {
			$(this).tooltip('dispose');
		} else {
			$(this).tooltip('enable');
			$(this).tooltip('show');
		}
	});
});

if (isProject == 'false') {
	$(window).bind('load', async function () {
		const dropdownWrapperBox = document.querySelector('.dropdown-wrapper-box');
		const projectWrapper = document.querySelector('.project-wrapper.pc-project-wrapper');
		const dropdownItems = document.querySelectorAll('.dropdown-wrapper-box .dropdown-item-brand');
		let selectedBrandElement = document.querySelector('.nav-link .selected-brand');
		projectWrapper.innerHTML = '';

		const responseCompanies = await getAllCompanies();
		if (responseCompanies.status === 1) {
			companyListCommon = responseCompanies.data;
			let selectedCompanyValue = getCookie('selectedCompany');
			const selectedProjectValue = getCookie('selectedProject');

			//---------------------------------
			// ADD "All Companies" OPTION
			//---------------------------------
			const isDashboard = window.location.pathname.includes("dashboard");

			if (isDashboard) {
				const allCompanyItem = document.createElement('a');
				allCompanyItem.className = `dropdown-item dropdown-item-brand ${!selectedCompanyValue || selectedCompanyValue === 'all' ? 'active' : ''}`;
				allCompanyItem.href = 'javascript:void(0);';
				allCompanyItem.dataset.companyId = 'all';
				allCompanyItem.dataset.companyName = 'All Companies';

				allCompanyItem.innerHTML = `
				<div class="selected-content selected-content-all">
					All Companies
					<div class="icon-box">
						<i class="fas fa-angle-right brand-arrow"></i>
					</div>
				</div>
				<div class="project-content mb-project-content"></div>
			`;

				// If "All Companies" is active on load
				if (selectedCompanyValue === 'all') {
					if (selectedBrandElement) {
						selectedBrandElement.innerText = 'All Companies: ' + (getCookie('selectedProjectName') || 'All Projects');
					}
					await loadAllProjects(allCompanyItem);
				}

				dropdownWrapperBox.appendChild(allCompanyItem);

				allCompanyItem.addEventListener('click', async (e) => {
					document.querySelectorAll('.dropdown-item-brand').forEach(el => el.classList.remove('active'));
					e.currentTarget.classList.add('active');

					setCookie('selectedCompany', 'all');

					const currentProject = getCookie('selectedProject');
					if (!currentProject) {
						setCookie('selectedProject', '');
						setCookie('selectedProjectName', 'Default');
					}

					if (selectedBrandElement) {
						const projectName = getCookie('selectedProjectName') || 'Default';
						selectedBrandElement.innerText = `All Companies: ${projectName}`;
					}

					// Clear old project content and reload
					document.querySelectorAll('.project-content').forEach(el => el.remove());
					const newProjectContent = document.createElement('div');
					newProjectContent.className = 'project-content mb-project-content';
					e.currentTarget.appendChild(newProjectContent);

					await loadAllProjects(e.currentTarget);
				});

			}

			//---------------------------------
			// LOOP COMPANIES
			//---------------------------------
			responseCompanies.data.forEach((company, index) => {
				const companyItem = document.createElement('a');
				companyItem.className = `dropdown-item dropdown-item-brand ${company._id === selectedCompanyValue ? 'active' : ''}`;
				companyItem.href = 'javascript:void(0);';
				companyItem.dataset.companyId = company._id;
				companyItem.dataset.companyName = company.name;

				companyItem.innerHTML = `
					<div class="selected-content selected-content${index + 1}">
						${company.name}
						<div class="icon-box">
							<i class="fas fa-angle-right brand-arrow"></i>
						</div>
					</div>
					<div class="project-content mb-project-content"></div>
				`;

				// Handle initial selection
				if (!selectedCompanyValue && index === 0) {
					companyItem.classList.add('active');
					setCookie('selectedCompany', company._id);
					setCookie('selectedProject', '');
					setCookie('selectedProjectName', 'Default');
					if (selectedBrandElement) {
						selectedBrandElement.innerText = company.name + ': Default';
					}
					loadProjects(company._id, companyItem);
				} else if (company._id === selectedCompanyValue) {
					if (selectedBrandElement) {
						selectedBrandElement.innerText = company.name + ': ' + (getCookie('selectedProjectName') || 'Default');
					}
					loadProjects(company._id, companyItem);
				}

				dropdownWrapperBox.appendChild(companyItem);
			});

			document.querySelectorAll('.dropdown-item-brand').forEach(item => {
				item.addEventListener('click', async (e) => {
					let currentCompanyId = e.currentTarget.dataset.companyId;
					let companyName = e.currentTarget.dataset.companyName;

					// remove active from all, then set current
					document.querySelectorAll('.dropdown-item-brand').forEach(el => el.classList.remove('active'));
					e.currentTarget.classList.add('active');

					// avoid reloading if already selected
					if (currentCompanyId === selectedCompanyValue) {
						return;
					}

					selectedCompanyValue = currentCompanyId;

					// clean old project content
					document.querySelectorAll('.project-content').forEach((el) => el.remove());

					// create fresh container
					const newProjectContent = document.createElement('div');
					newProjectContent.className = 'project-content mb-project-content';
					e.currentTarget.appendChild(newProjectContent);

					// ALL COMPANIES
					if (currentCompanyId === 'all') {
						setCookie('selectedCompany', 'all');
						setCookie('selectedProject', 'all');
						setCookie('selectedProjectName', 'All Projects');

						if (selectedBrandElement) {
							selectedBrandElement.innerText = 'All Companies: All Projects';
						}

						await loadAllProjects(newProjectContent);
						location.reload();
						return;
					}

					// Normal company
					setCookie('selectedCompany', currentCompanyId);
					setCookie('selectedProject', '');
					setCookie('selectedProjectName', 'Default');

					if (selectedBrandElement) {
						selectedBrandElement.innerText = companyName + ': ' + getCookie('selectedProjectName');
					}

					await loadProjects(currentCompanyId, newProjectContent);
					location.reload();
				});
			});

			async function loadAllProjects(companyItem) {
				try {
					const response = await getAllProjects(); // << existing API
					if (response.status !== 1) return;

					const projects = response.data;
					projectListCommon = projects;
					const selectedProjectValue = getCookie('selectedProject');

					// ----------------------
					// PC PROJECT CONTENT
					// ----------------------
					const projectContentId = `project-content-all`;
					let projectContent = document.getElementById(projectContentId);
					if (projectContent) projectContent.remove();

					projectContent = document.createElement('div');
					projectContent.id = projectContentId;
					projectContent.className = `project-content ${companyItem.classList.contains('active') ? 'active' : ''}`;

					// All Projects option
					const allProject = document.createElement('div');
					allProject.className = `project-name ${selectedProjectValue === 'all' ? 'active' : ''}`;
					allProject.innerHTML = `<span class="display-none">All Companies:</span> All Projects`;
					allProject.addEventListener('click', () => {
						document.querySelectorAll('.pc-project-wrapper .project-name').forEach((el) => el.classList.remove('active'));
						allProject.classList.add('active');
						setCookie('selectedProject', 'all');
						setCookie('selectedProjectName', 'All Projects');
						location.reload();
					});
					projectContent.appendChild(allProject);

					// Default option
					const defaultProject = document.createElement('div');
					defaultProject.className = `project-name ${selectedProjectValue === '' ? 'active' : ''}`;
					defaultProject.innerHTML = `<span class="display-none">All Companies:</span> Default`;
					defaultProject.addEventListener('click', () => {
						document.querySelectorAll('.pc-project-wrapper .project-name').forEach((el) => el.classList.remove('active'));
						defaultProject.classList.add('active');
						setCookie('selectedProject', '');
						setCookie('selectedProjectName', 'Default');
						location.reload();
					});
					projectContent.appendChild(defaultProject);

					// Individual projects
					projects.forEach((project) => {
						const projectName = document.createElement('div');
						projectName.className = `project-name ${project._id === selectedProjectValue ? 'active' : ''}`;
						projectName.innerHTML = `<span class="display-none">${project.companyName}:</span> ${project.name}`;

						projectName.addEventListener('click', () => {
							document.querySelectorAll('.pc-project-wrapper .project-name').forEach((el) => el.classList.remove('active'));
							projectName.classList.add('active');
							setCookie('selectedProject', project._id);
							setCookie('selectedProjectName', project.name);
							location.reload();
						});

						projectContent.appendChild(projectName);
					});

					// Append PC wrapper
					let projectWrapper = document.querySelector('.project-wrapper.pc-project-wrapper');
					if (!projectWrapper) {
						projectWrapper = document.createElement('div');
						projectWrapper.className = 'project-wrapper pc-project-wrapper';
						document.body.appendChild(projectWrapper);
					}
					projectWrapper.appendChild(projectContent);

					// ----------------------
					// MOBILE PROJECT CONTENT
					// ----------------------
					const mbProjectContent = companyItem.querySelector('.mb-project-content');
					if (mbProjectContent) {
						// Clear old projects
						mbProjectContent.querySelectorAll('.project-name').forEach(el => el.remove());

						const fragment = document.createDocumentFragment();

						// All Projects option (mobile)
						const allProjectMb = allProject.cloneNode(true);
						allProjectMb.addEventListener('click', () => {
							document.querySelectorAll('.mb-project-content .project-name').forEach((el) => el.classList.remove('active'));
							allProjectMb.classList.add('active');
							setCookie('selectedProject', 'all');
							setCookie('selectedProjectName', 'All Projects');
							location.reload();
						});
						fragment.appendChild(allProjectMb);

						// Default option (mobile)
						const defaultProjectMb = defaultProject.cloneNode(true);
						defaultProjectMb.addEventListener('click', () => {
							document.querySelectorAll('.mb-project-content .project-name').forEach((el) => el.classList.remove('active'));
							defaultProjectMb.classList.add('active');
							setCookie('selectedProject', '');
							setCookie('selectedProjectName', 'Default');
							location.reload();
						});
						fragment.appendChild(defaultProjectMb);

						// Individual projects (mobile)
						projects.forEach((project) => {
							const projectNameMb = document.createElement('div');
							projectNameMb.className = `project-name ${project._id === selectedProjectValue ? 'active' : ''}`;
							projectNameMb.innerHTML = `<span class="display-none">${project.companyName}:</span> ${project.name}`;

							projectNameMb.addEventListener('click', () => {
								document.querySelectorAll('.mb-project-content .project-name').forEach((el) => el.classList.remove('active'));
								projectNameMb.classList.add('active');
								setCookie('selectedProject', project._id);
								setCookie('selectedProjectName', project.name);
								location.reload();
							});

							fragment.appendChild(projectNameMb);
						});

						mbProjectContent.appendChild(fragment);
					}
				} catch (error) {
					console.error('Error fetching all projects:', error);
				}
			}


			// async function loadAllProjects(companyItem) {
			// 	try {
			// 		const response = await getAllProjects(); // << use existing API
			// 		if (response.status === 1) {
			// 			const projects = response.data;
			// 			const selectedProjectValue = getCookie('selectedProject');

			// 			const projectContentId = `project-content-all`;
			// 			let projectContent = document.getElementById(projectContentId);
			// 			if (projectContent) projectContent.remove();

			// 			projectContent = document.createElement('div');
			// 			projectContent.id = projectContentId;
			// 			projectContent.className = `project-content ${companyItem.classList.contains('active') ? 'active' : ''}`;

			// 			const allProject = document.createElement('div');
			// 			allProject.className = `project-name ${selectedProjectValue === 'all' ? 'active' : ''}`;
			// 			allProject.innerHTML = `<span class="display-none">All Companies:</span> All Projects`;
			// 			allProject.addEventListener('click', () => {
			// 				document.querySelectorAll('.project-name').forEach((el) => el.classList.remove('active'));
			// 				allProject.classList.add('active');
			// 				setCookie('selectedProject', 'all', 10);
			// 				setCookie('selectedProjectName', 'All Projects', 10);
			// 				location.reload();
			// 			});
			// 			projectContent.appendChild(allProject);

			// 			// --- Default Project (after all projects) ---
			// 			const defaultProject = document.createElement('div');
			// 			defaultProject.className = `project-name ${selectedProjectValue === '' ? 'active' : ''}`;
			// 			defaultProject.innerHTML = `<span class="display-none">All Companies:</span> Default`;

			// 			defaultProject.addEventListener('click', () => {
			// 				document.querySelectorAll('.project-name').forEach(el => el.classList.remove('active'));
			// 				defaultProject.classList.add('active');
			// 				setCookie('selectedProject', '', 10);
			// 				setCookie('selectedProjectName', 'Default', 10);
			// 				location.reload();
			// 			});

			// 			projectContent.appendChild(defaultProject);

			// 			// Add individual projects (with companyName: projectName format)
			// 			projects.forEach((project) => {
			// 				const projectName = document.createElement('div');
			// 				projectName.className = `project-name ${project._id === selectedProjectValue ? 'active' : ''}`;
			// 				projectName.innerHTML = `<span class="display-none">${project.companyName}:</span> ${project.name}`;

			// 				projectName.addEventListener('click', () => {
			// 					document.querySelectorAll('.project-name').forEach((el) => el.classList.remove('active'));
			// 					projectName.classList.add('active');
			// 					setCookie('selectedProject', project._id, 10);
			// 					setCookie('selectedProjectName', project.name, 10);
			// 					location.reload();
			// 				});

			// 				projectContent.appendChild(projectName);
			// 			});

			// 			let projectWrapper = document.querySelector('.project-wrapper.pc-project-wrapper');
			// 			if (!projectWrapper) {
			// 				projectWrapper = document.createElement('div');
			// 				projectWrapper.className = 'project-wrapper pc-project-wrapper';
			// 				document.body.appendChild(projectWrapper);
			// 			}

			// 			projectWrapper.appendChild(projectContent);
			// 		}
			// 	} catch (error) {
			// 		console.error('Error fetching all projects:', error);
			// 	}
			// }


			async function loadProjects(companyId, companyItem) {
				try {
					const response = await getAllCompanyProjects(companyId);
					
					if (response.status === 1) {
						const projects = response.data;
						projectListCommon = projects;
						const selectedProjectValue = getCookie('selectedProject');

						const projectContentId = `project-content-${companyId}`;
						let projectContent = document.getElementById(projectContentId);

						if (projectContent) {
							projectContent.remove();
						}

						projectContent = document.createElement('div');
						projectContent.id = projectContentId;
						projectContent.className = `project-content ${companyItem.classList.contains('active') ? 'active' : ''}`;

						const projectNameClass = companyItem.querySelector('.selected-content');
						let companyNameDropDown = projectNameClass.childNodes[0].textContent.trim();

						const defaultProject = document.createElement('div');
						defaultProject.className = `project-name ${selectedProjectValue === '' ? 'active' : ''}`;
						defaultProject.innerHTML = `<span class="display-none">${companyNameDropDown}:</span> Default `;

						defaultProject.addEventListener('click', () => {
							document.querySelectorAll('.project-name').forEach((el) => el.classList.remove('active'));
							defaultProject.classList.add('active');
							setCookie('selectedProject', '');
							setCookie('selectedProjectName', 'Default');
							location.reload();
						});

						const defaultProject1 = document.createElement('div');
						defaultProject1.className = `project-name ${selectedProjectValue === '' ? 'active' : ''}`;
						defaultProject1.innerHTML = `<span class="display-none">${companyNameDropDown}:</span> Default `;

						defaultProject1.addEventListener('click', () => {
							document.querySelectorAll('.mb-project-content .project-name').forEach((el) => el.classList.remove('active'));
							defaultProject.classList.add('active');
							setCookie('selectedProject', '');
							setCookie('selectedProjectName', 'Default');
							location.reload();
						});

						const mbProjectContent = companyItem.querySelector('.active .mb-project-content');

						const fragment = document.createDocumentFragment();
						if (mbProjectContent) {
							const existingProjectNames = mbProjectContent.querySelectorAll('.active .mb-project-content .project-name');
							existingProjectNames.forEach((el) => el.remove());

							fragment.appendChild(defaultProject1);

							projects.forEach((project) => {
								const projectName1 = document.createElement('div');
								projectName1.className = `project-name ${project._id === selectedProjectValue ? 'active' : ''}`;
								projectName1.innerHTML = `<span class="display-none">${companyNameDropDown}:</span> ${project.name}`;

								projectName1.addEventListener('click', () => {
									document.querySelectorAll('.mb-project-content .project-name').forEach((el) =>
										el.classList.remove('active')
									);
									projectName1.classList.add('active');
									setCookie('selectedProject', project._id);
									setCookie('selectedProjectName', project.name);
									location.reload();
								});

								fragment.appendChild(projectName1);
							});

							mbProjectContent.appendChild(fragment);
						}

						projectContent.appendChild(defaultProject);

						projects.forEach((project) => {
							const projectName = document.createElement('div');
							projectName.className = `project-name ${project._id === selectedProjectValue ? 'active' : ''}`;
							projectName.innerHTML = `<span class="display-none">${companyNameDropDown}:</span> ${project.name}`;

							projectName.addEventListener('click', () => {
								document.querySelectorAll('.pc-project-wrapper .project-name').forEach((el) =>
									el.classList.remove('active')
								);
								projectName.classList.add('active');
								setCookie('selectedProject', project._id);
								setCookie('selectedProjectName', project.name);
								location.reload();
							});

							projectContent.appendChild(projectName);
						});

						let projectWrapper = document.querySelector('.project-wrapper.pc-project-wrapper');
						if (!projectWrapper) {
							projectWrapper = document.createElement('div');
							projectWrapper.className = 'project-wrapper pc-project-wrapper';
							document.body.appendChild(projectWrapper);
						}

						projectWrapper.appendChild(projectContent);
					}
				} catch (error) {
					console.error('Error fetching projects:', error);
				}
			}

			let tooltipText = selectedBrandElement.textContent.trim();

			// Add title attribute for native tooltip
			selectedBrandElement.setAttribute('title', tooltipText);

			// Optionally, if you're using Bootstrap or similar
			selectedBrandElement.setAttribute('data-toggle', 'tooltip');

			$('.overlay, body').addClass('loaded');
			$('.overlay').css({ 'display': 'none' });
		} else {
			$('.overlay, body').addClass('loaded');
			$('.overlay').css({ 'display': 'none' });
		}
	});
} else {
	setTimeout(function () {
		$('.overlay, body').addClass('loaded');
		$('.overlay').css({ 'display': 'none' })
	}, 1000);
}

$('body').on('keyup', 'form input', function () {
	const elementName = $(this).attr('name');
	if (formValidator && formValidator.element(`[name="${elementName}"]`)) {
		clearErrorForElement(this);
	}
});

$('body').on('change', 'form select', function () {
	const elementName = $(this).attr('name');
	if (formValidator && formValidator.element(`[name="${elementName}"]`)) {
		clearErrorForElement(this);
	}
});

function intervalFunc() {
	const dc = document.cookie;
	const base_url = window.location.origin;
	const url = window.location.href;
	const prefix = 'Token=';
	let begin = dc.indexOf(`; ${prefix}`);

	if (begin == -1) {
		begin = dc.indexOf(prefix);
		if (begin != 0) {
			// console.log('begin != 0');
			if (url != `${base_url}/not-authorized`) {
				window.location.href = `${base_url}/not-authorized`;
			}
		}
	} else {
		begin += 2;
		let end = document.cookie.indexOf(';', begin);
		if (end == -1) {
			end = dc.length;
		}
	}
}

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

function setCookie(name, value, hours) {
	let expires = '';
	if (value === undefined || value === 'undefined') {
		console.warn(`Skipping cookie "${name}" because value is invalid`);
		return;
	}

	if (hours) {
		const date = new Date();
		date.setTime(date.getTime() + (hours * 60 * 60 * 1000));
		expires = `; expires=${date.toUTCString()}`;
	}

	document.cookie = `${name}=${encodeURIComponent(value || '')}${expires}; domain=${window.location.hostname}; path=/; Secure; SameSite=None`;
}

function getCookie(name) {
	const nameEQ = `${name}=`;
	const ca = document.cookie.split(';');

	for (let i = 0; i < ca.length; i++) {
		let c = ca[i];
		while (c.charAt(0) === ' ') c = c.substring(1, c.length);
		if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
	}

	return null;
}

function dateFormat(data) {
	const date = new Date(data);
	const pad = (num, size = 2) => ('000' + num).slice(-size);

	const year = date.getFullYear();
	const month = pad(date.getMonth() + 1);
	const day = pad(date.getDate());
	const hours = pad(date.getHours());
	const minutes = pad(date.getMinutes());
	const seconds = pad(date.getSeconds());
	const milliseconds = pad(date.getMilliseconds(), 3);

	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function getAllCompanies() {
	return new Promise((resolve, reject) => {
		$.ajax({
			url: '/master/companies/all',
			method: 'GET',
			success: function (response) {
				resolve(response);
			},
			error: function (xhr, status, error) {
				reject({ status: 0, message: xhr?.responseJSON?.message });
			}
		});
	});
}

function getAllCompanyProjects(companyId) {
	return new Promise((resolve, reject) => {
		$.ajax({
			url: '/master/projects/all-company-project',
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ companyId }),
			success: function (response) {
				resolve(response);
			},
			error: function (xhr, status, error) {
				reject({ status: 0, message: xhr?.responseJSON?.message });
			}
		});
	});
}

function getAllProjects() {
	return new Promise((resolve, reject) => {
		$.ajax({
			url: '/master/projects/all',
			method: 'GET',
			contentType: 'application/json',
			success: function (response) {
				resolve(response);
			},
			error: function (xhr, status, error) {
				reject({ status: 0, message: xhr?.responseJSON?.message });
			}
		});
	});
}

function getAllProjectEnvironments(companyId, projectId) {
	let payload = {};
	if (projectId !== "all") {
		payload.projectId = projectId === ' ' ? null : projectId;
	}

	if (companyId !== "all") {
		payload.companyId = companyId;
	}

	return new Promise((resolve, reject) => {
		$.ajax({
			url: '/master/environments/all-project-environment',
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify(payload),
			success: function (response) {
				resolve(response);
			},
			error: function (xhr, status, error) {
				reject({ status: 0, message: xhr?.responseJSON?.message || "Request failed" });
			}
		});
	});
}


function getAllEnvironments() {
	return new Promise((resolve, reject) => {
		$.ajax({
			url: '/master/environments/all',
			method: 'GET',
			contentType: 'application/json',
			success: function (response) {
				resolve(response);
			},
			error: function (xhr, status, error) {
				reject({ status: 0, message: xhr?.responseJSON?.message });
			}
		});
	});
}

function getAllItemList(companyId, projectId, environmentId) {
	let payload = {};
	if (environmentId !== "all") {
		payload.environmentId = environmentId;
	}
	if (projectId !== "all") {
		payload.projectId = projectId;
	}
	if (companyId !== "all") {
		payload.companyId = companyId;
	}
	return new Promise((resolve, reject) => {
		$.ajax({
			url: '/projects/item-name-list',
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify(payload),
			success: function (response) {
				resolve(response);
			},
			error: function (xhr, status, error) {
				reject({ status: 0, message: xhr?.responseJSON?.message });
			}
		});
	});
}

function toggleIconState(iconId, isEnabled, target) {
	const icon = $(`.${iconId}`);
	if (isEnabled) {
		icon.removeClass('disabled').css({
			'pointer-events': 'auto',
			'opacity': '1',
			'cursor': 'pointer'
		});
	} else {
		icon.addClass('disabled').css({
			'pointer-events': 'none',
			'opacity': '0.6',
			'cursor': 'not-allowed'
		});
	}

	if (target) {
		icon.addClass(target);
	}
}

toggleIconState('addIcon', false);
toggleIconState('printerIcon', false);
toggleIconState('trashIcon', false);
toggleIconState('cornerdownIcon', false);
toggleIconState('saveIcon', false);
toggleIconState('dollarIcon', false);
toggleIconState('downloadIcon', false);
toggleIconState('columnIcon', false);
toggleIconState('menuIcon', false);
toggleIconState('refreshIcon', true);

$('body').on('click', '.refreshIcon', function () {
	location.reload();
});