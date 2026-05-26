let viewFromDate = null,
    viewToDate = null;
const typingDelay = 1000;

let selectedCompanyValue = getCookie('selectedCompany');
let selectedProjectValue = getCookie('selectedProject');
let selcetedDashboardSelectedItem = getCookie('dashboardSelectedItem');

$(document).ready(async function () {
    let logsTable = null,
        logsPerPage = 50,
        logsCurrentPage = 1,
        resdLogTotalRecords = 0,
        logStartTime = null,
        logEndTime = null,
        viewLogsTable = null,
        viewNewLogsTable = null,
        transactionsTable = null,
        slowestTable = null,
        exceptionTable = null,
        resViewlogTotalRecords = 0,
        emailLogsTable = '',
        viewLogsItemId = '',
        viewLogsType = '',
        viewLogsPerPage = 50,
        detailsTable = null,
        detailsperPage = 50,
        detailscurrentPage = 1,
        responseData = null,
        api_response_throughput = [],
        api_response_network = [],
        api_response_exception = [],
        currentPoint = null,
        chartItemId = '',
        eperPage = 50,
        ecurrentPage = 1,
        exe_type = '',
        exception_table = null,
        resExeptionTotalRecords = 0,
        itemOptionsList = [],
        viewLogsCurrentPage = 1,
        typingTimer;

    transactionsTable = $('.transactions-table').DataTable({
        paging: false,
        searching: false,
        info: false,
        ordering: false,
        autoWidth: false,
        responsive: true,
    });

    slowestTable = $('.slowest-table').DataTable({
        paging: false,
        searching: false,
        info: false,
        ordering: false,
        autoWidth: false,
        responsive: true,
    });

    exceptionTable = $('.exceptions-table').DataTable({
        paging: false,
        searching: false,
        info: false,
        ordering: false,
        autoWidth: false,
        responsive: true,
    });

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

    const presetRanges = {};
    for (const [label, minutes] of Object.entries(timeOptions)) {
        presetRanges[label] = [moment().subtract(minutes, 'minutes'), moment()];
    }

    let query = getCookieJSON('logsCondition');

    if (query) {
        if (query.time && timeOptions[query.time]) {
            const now = new Date();
            const minutes = timeOptions[query.time];
            viewFromDate = new Date(now.getTime() - minutes * 60000).toISOString();
            viewToDate = now.toISOString();
        } else if (query.viewFromDate && query.viewToDate) {
            viewFromDate = query.viewFromDate;
            viewToDate = query.viewToDate;
        }
    } else {
        // Default: last 24 hours
        const now = new Date();
        viewToDate = now.toISOString();
        viewFromDate = new Date(now.getTime() - 1440 * 60000).toISOString(); // 24 hours
        query = { time: "24 hours", viewFromDate, viewToDate };
        setCookie('logsCondition', JSON.stringify(query));
    }

    const startMoment = moment(viewFromDate);
    const endMoment = moment(viewToDate);

    function cb(start, end) {
        const drp = $('#dashboardreportrange').data('daterangepicker');
        if (!drp) return;

        function areMomentsClose(m1, m2, toleranceMinutes = 1) {
            return Math.abs(m1.diff(m2, 'minutes')) <= toleranceMinutes;
        }

        let matchedLabel = null;
        const ranges = drp.ranges || {};
        for (const [label, range] of Object.entries(ranges)) {
            if (areMomentsClose(start, range[0]) && areMomentsClose(end, range[1])) {
                matchedLabel = label;
                break;
            }
        }

        if (matchedLabel) {
            $('#dashboardreportrange span').html(matchedLabel);
            $('.since-time-dashboard').text(matchedLabel);
            $('.ranges li').each(function () {
                if ($(this).text().trim() === matchedLabel) $(this).addClass('active');
            });
        } else {
            const formatted = `${start.format('MMMM D, YYYY HH:mm:ss')} - ${end.format('MMMM D, YYYY HH:mm:ss')}`;
            $('#dashboardreportrange span').html(formatted);
            $('.since-time-dashboard').text('Custom Range');
        }

        // Update viewFromDate and viewToDate
        viewFromDate = start.toISOString();
        viewToDate = end.toISOString();

        // Use matchedLabel or Custom Range as time, avoid duplication
        const timeLabel = matchedLabel || 'Custom Range';
        const existingQuery = getCookieJSON('logsCondition') || {};
        const queryObj = { ...existingQuery, time: timeLabel, viewFromDate, viewToDate };
        setCookie('logsCondition', JSON.stringify(queryObj));

        const log_description = $('#dashboard-log-description').val().trim();

        // Call fetch functions
        const durationMinutes = end.diff(start, 'minutes');
        fetchThroughputData(viewFromDate, viewToDate, durationMinutes, log_description);
        fetchExceptionData(viewFromDate, viewToDate, durationMinutes, log_description);
        fetchAvgItemData(viewFromDate, viewToDate, durationMinutes, log_description);
        fetchTransactionsList(viewFromDate, viewToDate, log_description);
        fetchSlowestList(viewFromDate, viewToDate, log_description);
        fetchExceptionList(viewFromDate, viewToDate, log_description);
    }

    $('#dashboardreportrange').daterangepicker({
        timePicker: true,
        timePicker24Hour: true,
        timePickerSeconds: true,
        startDate: startMoment,
        endDate: endMoment,
        locale: { format: 'MMMM D, YYYY HH:mm:ss' },
        ranges: presetRanges
    }, cb);

    cb(startMoment, endMoment);

    $('#dashboardreportrange').on('apply.daterangepicker', function (ev, picker) {
        cb(picker.startDate, picker.endDate);
    });

    let lastValue = '';
    $('body').on('click', '#dashboard-log-search-btn', function () {
        const value = $('#dashboard-log-description').val().trim();
        handleLogDescriptionChange(value);
    });

    function handleLogDescriptionChange(value) {
        lastValue = value;
        const query = getCookieJSON('logsCondition');

        // If it's a preset time range (not custom), recalculate from current time
        if (query && query.time && timeOptions[query.time]) {
            const now = new Date();
            const minutes = timeOptions[query.time];
            viewFromDate = new Date(now.getTime() - minutes * 60000).toISOString();
            viewToDate = now.toISOString();

            // Update the cookie with new timestamps
            const updatedQuery = { ...query, viewFromDate, viewToDate };
            setCookie('logsCondition', JSON.stringify(updatedQuery));
        }
        triggerLogDescriptionAPI(value);
    }

    async function triggerLogDescriptionAPI(value) {
        const start = moment(viewFromDate);
        const end = moment(viewToDate);
        const durationMinutes = end.diff(start, 'minutes');

        // Call your fetch APIs again with the same date range
        fetchThroughputData(viewFromDate, viewToDate, durationMinutes, value);
        fetchExceptionData(viewFromDate, viewToDate, durationMinutes, value);
        fetchAvgItemData(viewFromDate, viewToDate, durationMinutes, value);
        fetchTransactionsList(viewFromDate, viewToDate, value);
        fetchSlowestList(viewFromDate, viewToDate, value);
        fetchExceptionList(viewFromDate, viewToDate, value);
    }

    function resetSelect($select, placeholder = '-- Please Select --') {
        $select.empty().append(`<option value="">${placeholder}</option>`);
    }

    async function itemList(companyId, projectId, environmentId) {
        if (projectId == "") { projectId = " " }
        return getAllItemList(companyId, projectId, environmentId).then(responseItems => {
            if (responseItems.status === 1) {
                const $selectItems = $('#select-dashboard-item');
                resetSelect($selectItems);

                $('<option>', { value: 'all', text: 'All', selected: true }).appendTo($selectItems);

                $.each(responseItems.data, function (index, item) {
                    $('<option>', {
                        value: item._id,
                        text: item.ItemName,
                        'data-name': item.name
                    }).appendTo($selectItems);
                });

                itemOptionsList = responseItems.data || [];

                if (selcetedDashboardSelectedItem && $selectItems.find(`option[value="${selcetedDashboardSelectedItem}"]`).length > 0) {
                    $selectItems.val(selcetedDashboardSelectedItem);
                } else {
                    $selectItems.val('all');
                }

                $selectItems.trigger('change');

                return true;
            }
            throw new Error("Item fetch failed");
        });
    }

    itemList(selectedCompanyValue, selectedProjectValue);

    $('#select-dashboard-item').on('change', function () {
        const selectedItem = $(this).val();
        setCookie('dashboardSelectedItem', selectedItem);

        const log_description = $('#dashboard-log-description').val().trim();

        const query = getCookieJSON('logsCondition');

        // If it's a preset time range (not custom), recalculate from current time
        if (query && query.time && timeOptions[query.time]) {
            const now = new Date();
            const minutes = timeOptions[query.time];
            viewFromDate = new Date(now.getTime() - minutes * 60000).toISOString();
            viewToDate = now.toISOString();

            // Update the cookie with new timestamps
            const updatedQuery = { ...query, viewFromDate, viewToDate };
            setCookie('logsCondition', JSON.stringify(updatedQuery));
        }

        const start = moment(viewFromDate);
        const end = moment(viewToDate);
        const durationMinutes = end.diff(start, 'minutes');

        // Call your fetch APIs again with the same date range
        fetchThroughputData(viewFromDate, viewToDate, durationMinutes, log_description);
        fetchExceptionData(viewFromDate, viewToDate, durationMinutes, log_description);
        fetchAvgItemData(viewFromDate, viewToDate, durationMinutes, log_description);
        fetchTransactionsList(viewFromDate, viewToDate, log_description);
        fetchSlowestList(viewFromDate, viewToDate, log_description);
        fetchExceptionList(viewFromDate, viewToDate, log_description);
    });

    async function fetchTransactionsList(startTime, endTime, log_description) {
        let selcetedDashboardSelectedItem = getCookie('dashboardSelectedItem');
        try {
            const payload = {
                companyId: selectedCompanyValue,
                projectId: selectedProjectValue,
                itemId: selcetedDashboardSelectedItem,
                startTime,
                endTime,
                logDescription: log_description
            };

            const response = await $.ajax({
                url: "/dashboard/transactions/list",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify(payload)
            });

            if (response.status == 1) {
                transactionsTable.clear();

                if (response.data.length === 0) {
                    // show "no data" message via DataTables
                    transactionsTable.draw(false);
                    $('.overlay, body').addClass('loaded');
                    $('.overlay').hide();
                    return;
                }

                response.data.forEach((data, i) => {
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

                    const clickableLogDescription = logDescriptionText
                        ? `<span class="clickable-item-name" 
                            id="clickable-item-color"
                            data-item-id="${data?.item_id}" 
                            data-unique-id="${data.unique_id}" 
                            data-type="${data.type}" 
                            data-log-description="${logDescriptionText}">
                        ${logDescriptionText}
                      </span>`
                        : '';

                    let httpStatus = data?.last_end_log_history?.httpStatus || '';

                    // Add row for display
                    const rowNode = transactionsTable.row.add([
                        i + 1,
                        data?.item_details?.ItemName || '',
                        data.path || '',
                        clickableLogDescription,
                        httpStatus,
                        startTime,
                        differenceInMilliseconds
                    ]).draw(false).node();

                    // Store original data in the row DOM (safe with redraw)
                    $(rowNode).data('originalData', data);
                });

                const $tbody = $('.transactions-table tbody');
                $tbody.off('mouseenter mouseleave click');

                $tbody.on('mouseenter', 'tr', function (e) {
                    // Ignore hover when mouse is over clickable log description
                    if ($(e.target).closest('.clickable-item-name').length > 0) return;
                    $(this).css({
                        'background-color': '#8DC454',
                        'color': '#ffffff',
                        'cursor': 'pointer'
                    });
                });

                $tbody.on('mouseleave', 'tr', function () {
                    $(this).css({
                        'background-color': '',
                        'color': '#6E6B7B',
                        'cursor': 'default'
                    });
                });

                $tbody.on('click', 'tr', function (e) {
                    if ($(e.target).closest('.clickable-item-name').length > 0) return;
                    const rowData = $(this).data('originalData');
                    openDetailsLogs(rowData);
                });


                $('.overlay, body').addClass('loaded');
                $('.overlay').hide();
            }
        } catch (error) {
            console.error("Error fetching transactions:", error);
        }
    }

    $('body').on('click', '.clickable-item-name', function (e) {
        e.stopPropagation(); // stop from triggering row click
        openLogDescriptionModal(this);
    });

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
                        triggerLogDescriptionAPI($('#dashboard-log-description').val().trim());
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

    async function openLogDescriptionModal(element) {
        console.log(element, "element");
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

    function openDetailsLogs(rowData) {
        viewLogsItemId = rowData.unique_id;
        viewLogsType = rowData.type;
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
    }


    async function fetchSlowestList(startTime, endTime, log_description) {
        let selcetedDashboardSelectedItem = getCookie('dashboardSelectedItem');
        try {
            const payload = {
                companyId: selectedCompanyValue,
                projectId: selectedProjectValue,
                itemId: selcetedDashboardSelectedItem,
                startTime,
                endTime,
                logDescription: log_description
            };

            const response = await $.ajax({
                url: "/dashboard/transactions/slowest",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify(payload)
            });

            if (response.status == 1) {
                slowestTable.clear();

                if (response.data.length === 0) {
                    // show "no data" message via DataTables
                    slowestTable.draw(false);
                    $('.overlay, body').addClass('loaded');
                    $('.overlay').hide();
                    return;
                }

                response.data.forEach((data, i) => {
                    let httpStatus = data?.httpStatus || '';

                    const startDate = new Date(data.createdAt);
                    const startYear = startDate.getFullYear();
                    const startMonth = startDate.getMonth() + 1;
                    const startDay = startDate.getDate();
                    const startHours = (startDate.getHours() < 10 ? '0' : '') + startDate.getHours();
                    const startMinutes = (startDate.getMinutes() < 10 ? '0' : '') + startDate.getMinutes();
                    const startSeconds = (startDate.getSeconds() < 10 ? '0' : '') + startDate.getSeconds();
                    const startMilliseconds = (startDate.getMilliseconds() < 10 ? '00' : (startDate.getMilliseconds() < 100 ? '0' : '')) + startDate.getMilliseconds();
                    const startTime = startYear + '-' + (startMonth < 10 ? '0' : '') + startMonth + '-' + (startDay < 10 ? '0' : '') + startDay + ' ' + startHours + ':' + startMinutes + ':' + startSeconds + '.' + startMilliseconds;

                    const logDescriptionText = (data?.log_description?.datas || '').replace(/\n/g, '<br>');

                    const clickableLogDescription = logDescriptionText
                        ? `<span class="clickable-item-name" 
                            id="clickable-item-color"
                            data-item-id="${data?.item_id}" 
                            data-unique-id="${data.unique_id}" 
                            data-type="${data.type}" 
                            data-log-description="${logDescriptionText}">
                        ${logDescriptionText}
                      </span>`
                        : '';

                    const rowNode = slowestTable.row.add([
                        i + 1,
                        data?.item_details?.ItemName || '',
                        data.path || '',
                        clickableLogDescription,
                        httpStatus,
                        startTime,
                        data.durationMs
                    ]).draw(false).node();

                    $(rowNode).data('originalData', data);
                });

                $('.slowest-table tbody').off('mouseenter mouseleave click'); // remove previous handlers
                $('.slowest-table tbody').on('mouseenter', 'tr', function (e) {
                    if ($(e.target).closest('.clickable-item-name').length > 0) return;
                    $(this).css({
                        'background-color': '#8DC454',
                        'color': '#ffffff',
                        'cursor': 'pointer' // arrow pointer
                    });
                });
                $('.slowest-table tbody').on('mouseleave', 'tr', function (e) {
                    if ($(e.target).closest('.clickable-item-name').length > 0) return;
                    $(this).css({
                        'background-color': '',
                        'color': '#6E6B7B',
                        'cursor': 'default'
                    });
                });

                $('.slowest-table tbody').on('click', 'tr', function (e) {
                    if ($(e.target).closest('.clickable-item-name').length > 0) return;
                    const rowData = $(this).data('originalData');
                    openDetailsLogs(rowData)
                });

                slowestTable.draw(false);

                $('.overlay, body').addClass('loaded');
                $('.overlay').hide();
            }
        } catch (error) {
            console.error("Error fetching throughput:", error);
        }
    }

    async function fetchExceptionList(startTime, endTime, log_description) {
        let selcetedDashboardSelectedItem = getCookie('dashboardSelectedItem');
        try {
            const payload = {
                companyId: selectedCompanyValue,
                projectId: selectedProjectValue,
                itemId: selcetedDashboardSelectedItem,
                startTime,
                endTime,
                logDescription: log_description
            };

            const response = await $.ajax({
                url: "/dashboard/transactions/exception",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify(payload)
            });

            if (response.status == 1) {
                exceptionTable.clear();

                if (response.data.length === 0) {
                    // show "no data" message via DataTables
                    exceptionTable.draw(false);
                    $('.overlay, body').addClass('loaded');
                    $('.overlay').hide();
                    return;
                }

                response.data.forEach((data, i) => {
                    const startDate = new Date(data.createdAt);
                    const startYear = startDate.getFullYear();
                    const startMonth = startDate.getMonth() + 1;
                    const startDay = startDate.getDate();
                    const startHours = (startDate.getHours() < 10 ? '0' : '') + startDate.getHours();
                    const startMinutes = (startDate.getMinutes() < 10 ? '0' : '') + startDate.getMinutes();
                    const startSeconds = (startDate.getSeconds() < 10 ? '0' : '') + startDate.getSeconds();
                    const startMilliseconds = (startDate.getMilliseconds() < 10 ? '00' : (startDate.getMilliseconds() < 100 ? '0' : '')) + startDate.getMilliseconds();
                    const startTime = startYear + '-' + (startMonth < 10 ? '0' : '') + startMonth + '-' + (startDay < 10 ? '0' : '') + startDay + ' ' + startHours + ':' + startMinutes + ':' + startSeconds + '.' + startMilliseconds;

                    const rowNode = exceptionTable.row.add([
                        i + 1,
                        data?.item || '',
                        data?.exception_type || '',
                        data?.last_end_log_history?.path || '',
                        data?.detail_exception || '',
                        startTime
                    ]).draw(false).node();;

                    $(rowNode).data('originalData', data);
                });

                $('.exceptions-table tbody').off('mouseenter mouseleave click'); // remove previous handlers
                $('.exceptions-table tbody').on('mouseenter', 'tr', function () {
                    $(this).css({
                        'background-color': '#8DC454',
                        'color': '#ffffff',
                        'cursor': 'pointer' // arrow pointer
                    });
                });
                $('.exceptions-table tbody').on('mouseleave', 'tr', function () {
                    $(this).css({
                        'background-color': '',
                        'color': '#6E6B7B',
                        'cursor': 'default'
                    });
                });

                $('.exceptions-table tbody').on('click', 'tr', function () {
                    const rowData = $(this).data('originalData');
                    openDetailsLogs(rowData)
                });


                exceptionTable.draw(false);

                $('.overlay, body').addClass('loaded');
                $('.overlay').hide();
            }
        } catch (error) {
            console.error("Error fetching throughput:", error);
        }
    }

    const throughputConfigs = [
        { label: "30 mins", bucket: "5 minutes", hover: "1 minute", durationMinutes: 30 },
        { label: "60 mins", bucket: "5 minutes", hover: "1 minute", durationMinutes: 60 },
        { label: "3 hours", bucket: "15 minutes", hover: "1 minute", durationMinutes: 180 },
        { label: "6 hours", bucket: "30 minutes", hover: "2 minutes", durationMinutes: 360 },
        { label: "12 hours", bucket: "3 hours (180 mins)", hover: "5 minutes", durationMinutes: 720 },
        { label: "24 hours", bucket: "3 hours (180 mins)", hover: "10 minutes", durationMinutes: 1440 },
        { label: "3 days", bucket: "12 hours (720 mins)", hover: "30 minutes", durationMinutes: 4320 },
        { label: "7 days", bucket: "24 hours (1440 mins)", hover: "1 hour", durationMinutes: 10080 },
        { label: "1 month", bucket: "7 days", hover: "6 hours", durationMinutes: 43200 },
        { label: "3 months", bucket: "14 days", hover: "4 days", durationMinutes: 129600 },
    ];

    if ($.fn.DataTable.isDataTable('#exception_data_table')) {
        $('#exception_data_table').DataTable().clear().destroy();
    }

    exception_table = $('#exception_data_table').DataTable({
        order: [[0, 'desc']],
        aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
        pageLength: parseInt(eperPage),
        pagingType: 'full_numbers',
        aoColumns: [
            null,
            null,
            { 'sClass': 'line-break-anywhare' },
            null,
            null,
            null,
            null
        ]
    });

    $('body').on('click', '#exception_data_table_paginate .paginate_button', function () {
        ecurrentPage = $(this).attr('data-pageno');
        exception_table.clear();
        exception_table.destroy();
        exception_table = $('#exception_data_table').DataTable({
            order: [[0, 'desc']],
            aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
            pageLength: parseInt(eperPage),
            pagingType: 'full_numbers',
            aoColumns: [
                null,
                null,
                { 'sClass': 'line-break-anywhare' },
                null,
                null,
                null,
                null
            ]
        });
        const log_description = $('#dashboard-log-description').val().trim();
        openExceptionModalFunction(parseInt(eperPage), parseInt(ecurrentPage), logStartTime, logEndTime, exe_type, log_description);
    });

    $('body').on('change', '#exception_data_table_length select', function () {
        eperPage = $('#exception_data_table_length select').val();
        ecurrentPage = 1;
        exception_table.clear();
        exception_table.destroy();
        exception_table = $('#exception_data_table').DataTable({
            order: [[0, 'desc']],
            aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
            pageLength: parseInt(eperPage),
            pagingType: 'full_numbers',
            aoColumns: [
                null,
                null,
                { 'sClass': 'line-break-anywhare' },
                null,
                null,
                null,
                null
            ]
        });
        exception_table.page.len(eperPage).draw();
        const log_description = $('#dashboard-log-description').val().trim();
        openExceptionModalFunction(parseInt(eperPage), parseInt(ecurrentPage), logStartTime, logEndTime, exe_type, log_description);
    });

    exception_table.on('draw', function () {
        const perPage = exception_table.page.info().length;
        exceptionPagination(perPage, ecurrentPage, resExeptionTotalRecords);
    });

    detailsTable = $('#logs_details_table').DataTable({
        order: [[5, 'asc']],
        aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
        iDisplayLength: detailsperPage,
        pagingType: 'full_numbers',
    });

    $('body').on('click', '#exception_data_table a[data-uniqueId]', function (event) {
        event.preventDefault();
        detailsUniqueId = $(this).attr('data-uniqueId');

        detailsperPage = 50;
        detailscurrentPage = 1;
        detailsTable.clear();
        detailsTable.destroy();
        detailsTable = $('#logs_details_table').DataTable({
            order: [[5, 'asc']],
            aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
            iDisplayLength: detailsperPage,
            pagingType: 'full_numbers',
        });
        getDetailsData(parseInt(detailsperPage), parseInt(detailscurrentPage));

        $('#exception-details-modal').modal('show');
    });

    $('body').on('click', '#logs_details_table_paginate .paginate_button', function () {
        detailscurrentPage = $(this).attr('data-pageno');
        detailsTable.clear();
        detailsTable.destroy();
        detailsTable = $('#logs_details_table').DataTable({
            order: [[5, 'asc']],
            aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
            iDisplayLength: detailsperPage,
            pagingType: 'full_numbers',
        });
        getDetailsData(parseInt(detailsperPage), parseInt(detailscurrentPage));
    });

    $('body').on('change', '#logs_details_table_length select', function () {
        detailsperPage = $('#logs_details_table_length select').val();
        detailscurrentPage = 1;
        detailsTable.clear();
        detailsTable.destroy();
        detailsTable = $('#logs_details_table').DataTable({
            order: [[5, 'asc']],
            aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
            iDisplayLength: detailsperPage,
            pagingType: 'full_numbers',
        });
        getDetailsData(parseInt(detailsperPage), parseInt(detailscurrentPage));
    });

    if ($.fn.DataTable.isDataTable('#logs-data-table')) {
        $('#logs-data-table').DataTable().clear().destroy();
    }

    logsTable = $('#logs-data-table').DataTable({
        order: [[8, 'desc']],
        aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
        pageLength: logsPerPage,
        pagingType: 'full_numbers',
        aoColumns: [
            null, null, null, null, null,
            { width: "200px" },
            null, null, null, null, null, null
        ]
    });

    $('body').on('click', '#logs-data-table_paginate .paginate_button', function () {
        logsCurrentPage = $(this).attr('data-pageno');
        logsTable.clear();
        logsTable.destroy();
        logsTable = $('#logs-data-table').DataTable({
            order: [[8, 'desc']],
            aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
            pageLength: logsPerPage,
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
        const log_description = $('#dashboard-log-description').val().trim();
        openYourModalFunction(parseInt(logsPerPage), parseInt(logsCurrentPage), logStartTime, logEndTime, chartItemId, log_description);
    });

    logsTable.on('draw', function () {
        const perPage = logsTable.page.info().length;
        logsPagination(perPage, logsCurrentPage, resdLogTotalRecords);
    });

    $('body').on('change', '#logs-data-table_length select', function () {
        logsPerPage = $('#logs-data-table_length select').val();
        logsCurrentPage = 1;
        logsTable.clear();
        logsTable.destroy();
        logsTable = $('#logs-data-table').DataTable({
            order: [[8, 'desc']],
            aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
            pageLength: logsPerPage,
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
        const log_description = $('#dashboard-log-description').val().trim();
        openYourModalFunction(parseInt(logsPerPage), parseInt(logsCurrentPage), logStartTime, logEndTime, chartItemId, log_description);
    });

    if ($.fn.DataTable.isDataTable('#view-logs-data-table')) {
        $('#view-logs-data-table').DataTable().clear().destroy();
    }

    viewLogsTable = $('#view-logs-data-table').DataTable({
        order: [[5, 'asc']],
        aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
        pageLength: viewLogsPerPage,
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
            pageLength: viewLogsPerPage,
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
            pageLength: viewLogsPerPage,
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

    $('#log-details-page').on('click', function () {
        let uniqueId = $(this).attr('data-uniqueid-log');
        resetLogViews();
        oldViewLogDataItem(viewLogsPerPage, viewLogsCurrentPage, uniqueId)
    });

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

    if ($.fn.DataTable.isDataTable('#view-new-logs-data-table')) {
        $('#view-new-logs-data-table').DataTable().clear().destroy();
    }

    viewNewLogsTable = $('#view-new-logs-data-table').DataTable({
        ordering: false,
        paging: false,
        searching: false,
        info: false,
        lengthChange: false,
    });

    // CHART START

    function calculateDynamicBucket(totalMinutes) {
        if (totalMinutes <= 60) return { bucket: "5 minutes", hover: "1 minute" };
        if (totalMinutes <= 180) return { bucket: "15 minutes", hover: "1 minute" };
        if (totalMinutes <= 360) return { bucket: "30 minutes", hover: "2 minutes" };
        if (totalMinutes <= 720) return { bucket: "3 hours", hover: "5 minutes" };
        if (totalMinutes <= 1440) return { bucket: "3 hours", hover: "10 minutes" };
        if (totalMinutes <= 4320) return { bucket: "12 hours", hover: "30 minutes" };
        if (totalMinutes <= 10080) return { bucket: "24 hours", hover: "1 hour" };
        if (totalMinutes <= 43200) return { bucket: "7 days", hover: "6 hours" };
        if (totalMinutes <= 129600) return { bucket: "14 days", hover: "4 days" };
        return { bucket: "Custom", hover: "Custom" };
    }

    function getThroughputConfig(durationMinutes, startTime, endTime) {
        // Static presets
        const preset = throughputConfigs.find(c => c.durationMinutes === durationMinutes);
        if (preset) return preset;


        if (startTime && endTime) {
            const start = new Date(startTime);
            const end = new Date(endTime);
            const totalMinutes = (end - start) / (1000 * 60);
            const { bucket, hover } = calculateDynamicBucket(totalMinutes);

            // Compute rough months for label
            const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

            let label;
            if (totalMinutes < 60) {
                label = `Custom (~${Math.ceil(totalMinutes)} min)`;
            } else if (totalMinutes < 1440) {
                const hours = Math.floor(totalMinutes / 60);
                const minutes = Math.round(totalMinutes % 60);
                label = `Custom (~${hours} hour${hours > 1 ? "s" : ""} ${minutes > 0 ? minutes + " min" : ""})`;
            } else if (totalMinutes < 43200) {
                const days = Math.floor(totalMinutes / 1440);
                const hours = Math.round((totalMinutes % 1440) / 60);
                label = `Custom (~${days} day${days > 1 ? "s" : ""}${hours > 0 ? " " + hours + " hour" + (hours > 1 ? "s" : "") : ""})`;
            } else if (totalMinutes < 129600) {
                const months = Math.floor(totalMinutes / 43200);
                const days = Math.round((totalMinutes % 43200) / 1440);
                label = `Custom (~${months} month${months > 1 ? "s" : ""}${days > 0 ? " " + days + " day" + (days > 1 ? "s" : "") : ""})`;
            } else {
                const months = Math.floor(totalMinutes / 43200);
                const days = Math.round((totalMinutes % 43200) / 1440);
                label = `Custom (~${months} month${months > 1 ? "s" : ""}${days > 0 ? " " + days + " day" + (days > 1 ? "s" : "") : ""})`;
            }

            return { label, bucket, hover, startTime, endTime, totalMinutes };
        }

        return null;
    }

    function updateSubtitle(durationMinutes, startTime, endTime) {
        const config = getThroughputConfig(durationMinutes, startTime, endTime);
        if (config) {
            $(".card-sub-title").text(
                `${config.label} = ${config.bucket}`
            );
        } else {
            $(".card-sub-title").text("No config available");
        }
    }

    async function fetchThroughputData(startTime, endTime, durationMinutes, log_description) {
        let selcetedDashboardSelectedItem = getCookie('dashboardSelectedItem');
        try {
            const payload = {
                companyId: selectedCompanyValue,
                projectId: selectedProjectValue,
                itemId: selcetedDashboardSelectedItem,
                startTime,
                endTime,
                durationMinutes,
                logDescription: log_description
            };

            const response = await $.ajax({
                url: "/dashboard/throughput",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify(payload)
            });

            if (response.success) {
                updateSubtitle(durationMinutes, startTime, endTime);
                renderChart(response);
            } else {
                console.error("API returned error:", response);
            }
        } catch (error) {
            console.error("Error fetching throughput:", error);
        }
    }

    async function fetchExceptionData(startTime, endTime, durationMinutes, log_description) {
        let selcetedDashboardSelectedItem = getCookie('dashboardSelectedItem');
        try {
            const payload = {
                companyId: selectedCompanyValue,
                projectId: selectedProjectValue,
                itemId: selcetedDashboardSelectedItem,
                startTime,
                endTime,
                durationMinutes,
                logDescription: log_description
            };

            const response = await $.ajax({
                url: "/dashboard/exception",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify(payload)
            });

            if (response.success) {
                updateSubtitle(durationMinutes, startTime, endTime);
                renderExceptionChart(response);
            } else {
                console.error("API returned error:", response);
            }
        } catch (error) {
            console.error("Error fetching exception data:", error);
        }
    }

    async function fetchAvgItemData(startTime, endTime, durationMinutes, log_description) {
        let selcetedDashboardSelectedItem = getCookie('dashboardSelectedItem');
        try {
            const payload = {
                companyId: selectedCompanyValue,
                projectId: selectedProjectValue,
                itemId: selcetedDashboardSelectedItem,
                startTime,
                endTime,
                durationMinutes,
                logDescription: log_description
            };

            const response = await $.ajax({
                url: "/dashboard/network",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify(payload)
            });

            if (response.success) {
                updateSubtitle(durationMinutes, startTime, endTime);
                renderNetworkChart(response);
            } else {
                console.error("API returned error:", response);
            }
        } catch (error) {
            console.error("Error fetching exception data:", error);
        }
    }

    function renderChart(api_response1) {
        api_response_throughput = api_response1;
        const series = [{
            name: 'Total Throughput',
            data: api_response1.data.map(bucket => [
                Date.parse(bucket._id),
                bucket.totalCount
            ]),
            marker: { enabled: true },
            color: '#8DC454'
        }];

        const rangeMs = api_response1.endTime - api_response1.startTime;
        const durationDays = rangeMs / (24 * 60 * 60 * 1000);

        function formatXAxisLabel(value, durationDays) {
            if (durationDays <= 1) return Highcharts.dateFormat('%H:%M', value);
            if (durationDays <= 7) return Highcharts.dateFormat('%e %b %H:%M', value);
            if (durationDays <= 90) return Highcharts.dateFormat('%e %b', value);
            return Highcharts.dateFormat('%e %b %Y', value);
        }

        Highcharts.chart('line-chart-1', {
            chart: { type: 'line', zoomType: 'x' },
            time: { useUTC: false },
            title: { text: null },
            xAxis: {
                type: 'datetime',
                labels: {
                    formatter: function () {
                        return formatXAxisLabel(this.value, durationDays);
                    }
                },
                tickInterval: api_response1.hoverIntervalMs,
                title: { text: null }
            },
            yAxis: { min: 0, allowDecimals: false, title: { text: null } },

            tooltip: {
                useHTML: true,
                enabled: true,
                shared: false,
                stickOnContact: true,
                hideDelay: 500,
                formatter: function () {
                    const bucket = api_response1.data.find(
                        b => Date.parse(b._id) === this.x
                    );
                    const bucketEndTime = this.x + api_response1.bucketSizeMs;

                    const startLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x);
                    const endLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', bucketEndTime);

                    let html = `<div style="font-family:'Segoe UI'; font-size:13px; color:#333; line-height:1.4; padding:8px; min-width:200px;">`;
                    html += `<div style="font-weight:600; font-size:14px; margin-bottom:6px; text-align:center; color:#2c3e50;">${startLabel}</div>`;

                    if (api_response1.bucketSizeMs > 60000) {
                        html += `<div style="font-size:11px; margin-bottom:6px; text-align:center; color:#7f8c8d;">Range: ${startLabel} - ${endLabel}</div>`;
                    }

                    html += `<div style="background:#FFF9C4; color:#000; font-weight:600; padding:8px 10px; margin-bottom:8px; border-radius:6px; text-align:center; box-shadow:0 2px 4px rgba(0,0,0,0.15);">
                    Total Throughput: ${this.y}
                    </div>`;

                    if (bucket && bucket.perItem.length) {
                        // Wrap items in a scrollable container
                        html += `<div class="tooltip-scroll">`;
                        bucket.perItem.forEach((i, index) => {
                            html += `
                                <div class="tooltip-item tooltip-item-${index}" 
                                    style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; margin-bottom:4px; border-bottom:1px solid #eee;">
                                    
                                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:8px;" title="${i.item}">
                                        ${i.item}
                                    </span>
                                    
                                    <span style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                        <span style="background:#6E6B7B; color:#fff; font-weight:600; width:24px; height:20px; display:flex; justify-content:center; align-items:center; font-size:12px;">
                                            ${i.count}
                                        </span>
                                        <i class="fa fa-eye tooltip-icon" style="cursor:pointer; font-size:14px;"></i>
                                    </span>
                                </div>`;
                        });
                        html += `</div>`;
                    }

                    html += `</div>`;
                    return html;
                }
            },

            plotOptions: {
                series: {
                    cursor: 'pointer',
                    stickyTracking: false,
                    point: {
                        events: {
                            click: async function () {

                                const bucketStartTime = this.x;
                                const bucketEndTime = this.x + api_response1.bucketSizeMs;

                                const startLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', bucketStartTime);
                                const endLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', bucketEndTime);

                                logStartTime = startLabel;
                                logEndTime = endLabel;

                                let selcetedDashboardSelectedItem = getCookie('dashboardSelectedItem');
                                chartItemId = selcetedDashboardSelectedItem;
                                logsPerPage = 50;
                                logsCurrentPage = 1;
                                const log_description = $('#dashboard-log-description').val().trim();
                                await openYourModalFunction(logsPerPage, logsCurrentPage, logStartTime, logEndTime, chartItemId, log_description);
                            },
                            mouseOver: function () {
                                currentPoint = this;
                            }
                        }
                    }
                }
            },

            series: series,
            legend: { enabled: false },
            credits: { enabled: false },
            exporting: { enabled: false }
        });
    }

    $('#line-chart-1').on('click', '.tooltip-icon', async function () {
        if (!currentPoint) return;

        const $row = $(this).closest('.tooltip-item');
        const classes = $row.attr('class').split(/\s+/);
        const tooltipIndexClass = classes.find(c => c.startsWith('tooltip-item-'));
        if (!tooltipIndexClass) return;

        const index = parseInt(tooltipIndexClass.replace('tooltip-item-', ''), 10);
        const bucketStartTime = currentPoint.x;
        const bucketEndTime = bucketStartTime + api_response_throughput.bucketSizeMs;
        const startLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', bucketStartTime);
        const endLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', bucketEndTime);

        logStartTime = startLabel;
        logEndTime = endLabel;

        const bucketData = api_response_throughput.data.find(b => new Date(b._id).getTime() === bucketStartTime);
        if (!bucketData) return;

        const itemId = bucketData.perItem[index]?.itemId;
        if (!itemId) return;

        chartItemId = itemId;
        logsPerPage = 50;
        logsCurrentPage = 1;
        const log_description = $('#dashboard-log-description').val().trim();
        await openYourModalFunction(logsPerPage, logsCurrentPage, startLabel, endLabel, chartItemId, log_description);
    });

    function renderExceptionChart(api_response) {
        api_response_exception = api_response;

        const rangeMs = api_response.endTime - api_response.startTime;
        const durationDays = rangeMs / (24 * 60 * 60 * 1000);

        const series = [{
            name: "Total Exceptions",
            data: api_response.data.map(bucket => [
                Date.parse(bucket._id),
                bucket.totalCount || 0
            ]),
            marker: { enabled: true },
            color: "#ff4d4f"
        }];

        function formatXAxisLabel(value, durationDays) {
            if (durationDays <= 1) return Highcharts.dateFormat('%H:%M', value);
            if (durationDays <= 7) return Highcharts.dateFormat('%e %b %H:%M', value);
            if (durationDays <= 90) return Highcharts.dateFormat('%e %b', value);
            return Highcharts.dateFormat('%e %b %Y', value);
        }

        Highcharts.chart('line-chart-2', {
            chart: { type: 'line', zoomType: 'x' },
            title: { text: null },
            time: { useUTC: false },
            xAxis: {
                type: 'datetime',
                labels: {
                    formatter: function () {
                        return formatXAxisLabel(this.value, durationDays);
                    }
                },
                tickInterval: api_response.hoverIntervalMs,
                title: { text: null }
            },
            yAxis: {
                min: 0,
                allowDecimals: false,
                title: { text: null }
            },
            tooltip: {
                useHTML: true,
                enabled: true,
                shared: false,
                stickOnContact: true,
                hideDelay: 500,
                formatter: function () {

                    const bucket = api_response.data.find(b => Date.parse(b._id) === this.x);
                    const bucketEndTime = this.x + api_response.bucketSizeMs;

                    const startLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x);
                    const endLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', bucketEndTime);


                    let html = `<div style="font-family:'Segoe UI'; font-size:13px; color:#333; line-height:1.4; padding:8px; min-width:200px;">`;
                    html += `<div style="font-weight:600; font-size:14px; margin-bottom:6px; text-align:center; color:#2c3e50;">${startLabel}</div>`;

                    if (api_response.bucketSizeMs > 60000) {
                        html += `<div style="font-size:11px; margin-bottom:6px; text-align:center; color:#7f8c8d;">Range: ${startLabel} - ${endLabel}</div>`;
                    }

                    if (bucket) {

                        html += `<div style="background:#FFF9C4; color:#000; font-weight:600; padding:6px 10px; margin-bottom:6px; border-radius:6px; text-align:center; box-shadow:0 2px 4px rgba(0,0,0,0.15);">
                        Total Exceptions: ${this.y}
                         </div>`;


                        html += `<div class="tooltip-scroll">`;
                        if (bucket && bucket.exceptions.length) {
                            bucket.exceptions.forEach((i, index) => {
                                html += `
                            <div class="tooltip-exception tooltip-exception-${index}" 
                                style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; margin-bottom:4px; border-bottom:1px solid #eee;">
                                
                                <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:8px;" title="${i.type}">
                                    ${i.type}
                                </span>
                                
                                <span style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                    <!-- Count badge -->
                                    <span style="background:#6E6B7B; color:#fff; font-weight:600; width:24px; height:20px; display:flex; justify-content:center; align-items:center; font-size:12px;">
                                        ${i.count}
                                    </span>

                                    <!-- View icon -->
                                    <i class="fa fa-eye tooltip-exception-icon" style="cursor:pointer; font-size:14px;"></i>
                                </span>
                            </div>`;
                            });
                        }
                        html += `</div>`;
                    }

                    html += `</div>`;
                    return html;
                }
            },
            plotOptions: {
                series: {
                    cursor: 'pointer',
                    point: {
                        events: {
                            click: async function () {
                                const bucketStartTime = this.x;
                                const bucketEndTime = this.x + api_response.bucketSizeMs;

                                const startLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', bucketStartTime);
                                const endLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', bucketEndTime);

                                logStartTime = startLabel;
                                logEndTime = endLabel;
                                exe_type = '';
                                eperPage = 50;
                                ecurrentPage = 1;
                                const log_description = $('#dashboard-log-description').val().trim();
                                await openExceptionModalFunction(eperPage, ecurrentPage, logStartTime, logEndTime, exe_type, log_description);
                            },
                            mouseOver: function () {
                                currentPoint = this;
                            }
                        }
                    }
                }
            },
            series: series,
            legend: { enabled: false },
            credits: { enabled: false },
            exporting: { enabled: false }
        });
    }

    $('#line-chart-2').on('click', '.tooltip-exception-icon', async function () {
        if (!currentPoint) return;

        const $row = $(this).closest('.tooltip-exception');
        const classes = $row.attr('class').split(/\s+/);
        const tooltipIndexClass = classes.find(c => c.startsWith('tooltip-exception-'));
        if (!tooltipIndexClass) return;

        const index = parseInt(tooltipIndexClass.replace('tooltip-exception-', ''), 10);
        const bucketStartTime = currentPoint.x;
        const bucketEndTime = bucketStartTime + api_response_network.bucketSizeMs;
        const startLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', bucketStartTime);
        const endLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', bucketEndTime);

        logStartTime = startLabel;
        logEndTime = endLabel;


        const bucketData = api_response_exception.data.find(b => new Date(b._id).getTime() === bucketStartTime);
        if (!bucketData) return;

        const exception_type = bucketData.exceptions[index]?.type;
        if (!exception_type) return;

        exe_type = exception_type;
        eperPage = 50;
        ecurrentPage = 1;
        const log_description = $('#dashboard-log-description').val().trim();
        await openExceptionModalFunction(eperPage, ecurrentPage, startLabel, endLabel, exe_type, log_description);
    });

    function renderNetworkChart(api_response) {
        api_response_network = api_response;
        const rangeMs = api_response.endTime - api_response.startTime;

        const series = [{
            name: "Avg Response Time",
            data: api_response.data.map(b => [Date.parse(b._id), b.avgExecTime || 0]),
            marker: { enabled: true },
            color: "#3b82f6"
        }];

        const durationDays = rangeMs / (24 * 60 * 60 * 1000);

        function formatXAxisLabel(value, durationDays) {
            if (durationDays <= 1) return Highcharts.dateFormat('%H:%M', value);
            if (durationDays <= 7) return Highcharts.dateFormat('%e %b %H:%M', value);
            if (durationDays <= 90) return Highcharts.dateFormat('%e %b', value);
            return Highcharts.dateFormat('%e %b %Y', value);
        }

        Highcharts.chart("line-chart-3", {
            chart: { type: "line", zoomType: "x" },
            title: { text: null },
            time: { useUTC: false },
            xAxis: {
                type: "datetime",
                tickInterval: api_response.hoverIntervalMs,
                labels: {
                    formatter: function () {
                        return formatXAxisLabel(this.value, Math.floor(durationDays));
                    }
                }
            },
            yAxis: {
                min: 0,
                allowDecimals: false,
                title: { text: "ms" }
            },
            tooltip: {
                useHTML: true,
                enabled: true,
                shared: false,
                stickOnContact: true,
                hideDelay: 500,
                formatter: function () {
                    const bucket = api_response.data.find(b => Date.parse(b._id) === this.x);

                    const bucketEndTime = this.x + api_response.bucketSizeMs;

                    const startLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x);
                    const endLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', bucketEndTime);

                    let html = `<div style="font-family:'Segoe UI'; font-size:13px; color:#333; line-height:1.4; padding:8px; min-width:200px;">`;
                    html += `<div style="font-weight:600; font-size:14px; margin-bottom:6px; text-align:center; color:#2c3e50;">${startLabel}</div>`;

                    if (api_response.bucketSizeMs > 60000) {
                        html += `<div style="font-size:11px; margin-bottom:6px; text-align:center; color:#7f8c8d;">Range: ${startLabel} - ${endLabel}</div>`;
                    }

                    html += `<div style="background:#FFF9C4; color:#000; font-weight:600; padding:8px 10px; margin-bottom:8px; border-radius:6px; text-align:center;            box-shadow:0 2px 4px rgba(0,0,0,0.15);"> Total Throughput: ${bucket?.avgExecTime?.toFixed(2)} ms</div>`;

                    if (bucket && bucket.perItem.length) {
                        html += `<div class="tooltip-scroll">`;
                        bucket.perItem.forEach((i, index) => {
                            html += `<div class="tooltip-network-item tooltip-network-item-${index}" style="display:flex;justify-content:space-between;align-items:center;padding:2px;border-bottom:1px solid #eee;line-height:1.4;font-size:14px;background-color:#fff;">
                                 <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:8px;" title="${i.item}">
                                    ${i.item}
                                </span>
                                <span style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
                                    <span style="display:flex;justify-content:center;align-items:center;min-width:36px;font-size:13px;font-weight:500;background-color:#e8f5e9;color:#2e7d32;padding:2px 6px;border-radius:4px;">${i.avg.toFixed(2)}</span>
                                    <i class="fa fa-eye tooltip-network-icon" style="cursor:pointer;font-size:14px;color:#555;"></i>
                                </span>
                            </div>`;
                        });
                        html += `</div>`;
                    }
                    html += `</div>`;
                    return html;
                }
            },
            plotOptions: {
                series: {
                    cursor: 'pointer',
                    stickyTracking: false,
                    point: {
                        events: {
                            click: async function () {

                                const bucketStartTime = this.x;
                                const bucketEndTime = this.x + api_response.bucketSizeMs;

                                const startLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', bucketStartTime);
                                const endLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', bucketEndTime);

                                logStartTime = startLabel;
                                logEndTime = endLabel;
                                let selcetedDashboardSelectedItem = getCookie('dashboardSelectedItem');
                                chartItemId = selcetedDashboardSelectedItem;
                                logsPerPage = 50;
                                logsCurrentPage = 1;

                                const log_description = $('#dashboard-log-description').val().trim();
                                await openYourModalFunction(logsPerPage, logsCurrentPage, logStartTime, logEndTime, chartItemId, log_description);
                            },
                            mouseOver: function () {
                                currentPoint = this;
                            }
                        }
                    }
                }
            },
            series: series,
            credits: { enabled: false },
            legend: { enabled: false },
            exporting: { enabled: false }
        });
    }

    $('#line-chart-3').on('click', '.tooltip-network-icon', async function () {
        if (!currentPoint) return;

        const $row = $(this).closest('.tooltip-network-item');
        const classes = $row.attr('class').split(/\s+/);
        const tooltipIndexClass = classes.find(c => c.startsWith('tooltip-network-item-'));
        if (!tooltipIndexClass) return;

        const index = parseInt(tooltipIndexClass.replace('tooltip-network-item-', ''), 10);
        const bucketStartTime = currentPoint.x;
        const bucketEndTime = bucketStartTime + api_response_network.bucketSizeMs;
        const startLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', bucketStartTime);
        const endLabel = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', bucketEndTime);

        logStartTime = startLabel;
        logEndTime = endLabel;

        const bucketData = api_response_network.data.find(b => new Date(b._id).getTime() === bucketStartTime);
        if (!bucketData) return;

        const itemId = bucketData.perItem[index]?.itemId;
        if (!itemId) return;

        chartItemId = itemId;
        logsPerPage = 50;
        logsCurrentPage = 1;
        const log_description = $('#dashboard-log-description').val().trim();
        await openYourModalFunction(logsPerPage, logsCurrentPage, startLabel, endLabel, chartItemId, log_description);
    });

    // CHART END

    async function openYourModalFunction(logsPerPage, logsCurrentPage, startTime, endTime, item_id = '', log_description) {
        try {
            const payload = {
                companyId: selectedCompanyValue,
                projectId: selectedProjectValue,
                itemId: item_id,
                startTime,
                endTime,
                page: parseInt(logsCurrentPage),
                limit: parseInt(logsPerPage),
                type: 'log',
                logDescription: log_description
            };

            const response = await $.ajax({
                url: "/dashboard/throughput/throughput-history-by-pick-point",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify(payload)
            });

            if (response.status == 1) {
                let counter = (parseInt(logsCurrentPage) > 1) ? ((parseInt(logsPerPage) * (parseInt(logsCurrentPage) - 1)) + 1) : 1;
                let totalRecord = parseInt(response.total);
                resdLogTotalRecords = totalRecord;

                $('#logs_data_table tbody').empty();
                $('#logs_data_table tbody').html('<tr class="odd"><td valign="top" colspan="11" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

                if (response.data.length <= 0) {
                    $('#logs-data-table tbody').html('<tr class="odd"><td valign="top" colspan="11" class="dataTables_empty">No data available in table</td></tr>');
                }

                logsTable.clear();

                for (let i = 0; i < response.data.length; i++) {
                    let data = response.data[i];
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

                    // Apply underline class only if description exists
                    const clickableLogDescription = `<span class="${logDescriptionText ? 'clickable-item-name' : ''}" data-item-id="${data?.item_id}" data-unique-id="${data.unique_id}" data-type="${data.type}" data-log-description="${logDescriptionText}" onclick="openItemLogDescriptionModal(this)">${logDescriptionText}</span>`;

                    let $button_group = '<div class="btn-group" role="group" aria-label="Basic example">';
                    $button_group += '<button type="button" class="btn btn-outline-secondary view-item-logs-modal" data-toggle="tooltip" title="View" data-id="' + data.unique_id + '" data-type="' + data.type + '"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>';
                    $button_group += '</div>';

                    let httpStatus = data.all_log_httpstatus.length > 0 ? data.all_log_httpstatus[0].httpStatus : '';

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
                    ])
                }

                logsTable.draw(false);
                logsTable.page.len(parseInt(logsPerPage)).draw(false);

                logsPagination(logsPerPage, logsCurrentPage, totalRecord);

                $('#item-logs-modal-slide-in').modal('show');
                $('.overlay, body').addClass('loaded');
                $('.overlay').css({ 'display': 'none' });
            }
        } catch (error) {
            console.log(error);
            alert('server error');
        }
    }

    async function openExceptionModalFunction(perPage, currentPage, startTime, endTime, exe_type = '', log_description) {
        let selcetedDashboardSelectedItem = getCookie('dashboardSelectedItem');
        try {
            const payload = {
                companyId: selectedCompanyValue,
                projectId: selectedProjectValue,
                itemId: selcetedDashboardSelectedItem,
                startTime,
                endTime,
                page: parseInt(currentPage),
                limit: parseInt(perPage),
                exe_type,
                type: 'exception',
                logDescription: log_description
            };

            const response = await $.ajax({
                url: "/dashboard/exception/exception-history-by-pick-point",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify(payload)
            });

            if (response.status == 1) {
                let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
                let totalRecord = parseInt(response.total);
                resExeptionTotalRecords = totalRecord;

                $('#exception_data_table tbody').empty();
                $('#exception_data_table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

                if (response.data.length <= 0) {
                    $('#exception_data_table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty">No data available in table</td></tr>');
                }

                exception_table.clear();

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

                    const dataItem = data.item || "";
                    const itemName = '<a href="#" data-uniqueId="' + data.unique_id + '">' + dataItem + '</a>';

                    exception_table.row.add([
                        startTime,
                        data.exception_type || "",
                        data?.last_end_log_history?.path || "",
                        data.project || "",
                        itemName,
                        data.description || "",
                        data.detail_exception || ""
                    ])
                });

                $(".connection-error").html(response.connectionErrorTotal);
                $(".formula-error").html(response.formulaErrorTotal);
                $(".system-error").html(response.systemErrorTotal);

                exception_table.draw(false);
                exception_table.page.len(parseInt(perPage)).draw(false);

                exceptionPagination(perPage, currentPage, totalRecord);

                $('#exception-logs-modal-slide-in').modal('show');

                $('.overlay, body').addClass('loaded');
                $('.overlay').css({ 'display': 'none' });
            }
        } catch (error) {
            console.log(error);
            alert('server error');
        }
    }

    function exceptionPagination(perPage, currentPage, totalRecord) {
        $('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
        let startEntry = (parseInt(currentPage) == 1) ? 1 : ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1);
        let endEntry = (parseInt(currentPage) == 1) ? parseInt(perPage) : (parseInt(perPage) * parseInt(currentPage));
        endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

        if (totalRecord == 0) {
            startEntry = 0;
        }

        let showpage = "Showing " + startEntry + " to " + endEntry + " of " + totalRecord + " entries";
        $('body').find('#exception_data_table_info').html(showpage);

        let dataDtIdx = 0;
        let paginationHtml = '';
        let firstDisable = (parseInt(currentPage) == 1) ? "disabled" : "";
        let lastDisable = (parseInt(currentPage) == Math.ceil(totalRecord / parseInt(perPage))) ? "disabled" : "";

        if (Math.ceil(totalRecord / parseInt(perPage)) > 0) {
            paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="exception_data_table_first_1" data-pageno="1">First</a>';
            dataDtIdx++;
            paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="exception_data_table_previous_1" data-pageno="' + (parseInt(currentPage) - 1) + '">Previous</a>';
            paginationHtml += '<span>';
            dataDtIdx++;

            if (parseInt(currentPage) > 2) {
                paginationHtml += '<a class="paginate_button" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
                if (parseInt(currentPage) > 3) {
                    paginationHtml += '<span class="ellipsis">...</span>';
                }
                dataDtIdx++;
            }

            if ((parseInt(currentPage) - 1) > 0) {
                paginationHtml += '<a class="paginate_button" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) - 1) + '">' + (parseInt(currentPage) - 1) + '</a>';
                dataDtIdx++;
            }

            paginationHtml += '<a class="paginate_button current" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(currentPage) + '">' + parseInt(currentPage) + '</a>';
            dataDtIdx++;

            if ((parseInt(currentPage) + 1) < Math.ceil(totalRecord / parseInt(perPage)) + 1) {
                paginationHtml += '<a class="paginate_button" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) + 1) + '">' + (parseInt(currentPage) + 1) + '</a>';
                dataDtIdx++;
            }

            if (parseInt(currentPage) < Math.ceil(totalRecord / parseInt(perPage)) - 1) {
                if (((parseInt(currentPage) + 3) < Math.ceil(totalRecord / parseInt(perPage)) + 1)) {
                    paginationHtml += '<span class="ellipsis">...</span>';
                }
                paginationHtml += '<a class="paginate_button" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">' + Math.ceil(totalRecord / parseInt(perPage)) + '</a>';
                dataDtIdx++;
            }

            paginationHtml += '</span>';
            paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="exception_data_table_next_1" data-pageno="' + (parseInt(currentPage) + 1) + '">Next</a>';
            dataDtIdx++;
            paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="exception_data_table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">Last</a>';
        }

        $('body').find('#exception_data_table_paginate').html(paginationHtml);
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

    function getDetailsData(perPage, currentPage) {
        let searchItem = '';
        let uniqueId = detailsUniqueId;
        $('#logs_details_table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

        $.ajax({
            url: '/logs/logViewFullList',
            method: 'post',
            dataType: 'json',
            data: { page: parseInt(currentPage), limit: parseInt(perPage), type: 'log', searchItem, uniqueId },
            success: function (response) {
                responseData = response.data;
                let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
                let totalRecord = parseInt(response.total);

                if (response.data.length <= 0) {
                    $('#logs_details_table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty">No data available in table</td></tr>');
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

                    let $button_group = '<div class="btn-group" role="group" aria-label="Basic example">';
                    if (data.datas && data.datas !== "") {
                        $button_group += '<a href="#" class="btn btn-secondary" data-uniqueId="' + data._id + '">View</a>';
                    }
                    $button_group += '</div>';

                    detailsTable.row.add([
                        counter++,
                        data.action,
                        data.description,
                        data.type,
                        data.httpStatus || "",
                        startTime,
                        $button_group
                    ]).draw(false);
                });

                $('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
                let startEntry = (parseInt(currentPage) == 1) ? 1 : ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1);
                let endEntry = (parseInt(currentPage) == 1) ? parseInt(perPage) : (parseInt(perPage) * parseInt(currentPage));
                endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

                if (totalRecord == 0) {
                    startEntry = 0;
                }

                let showpage = "Showing " + startEntry + " to " + endEntry + " of " + totalRecord + " entries";
                $('body').find('#logs_details_table_info').html(showpage);

                let dataDtIdx = 0;
                let paginationHtml = '';
                let firstDisable = (parseInt(currentPage) == 1) ? "disabled" : "";
                let lastDisable = (parseInt(currentPage) == Math.ceil(totalRecord / parseInt(perPage))) ? "disabled" : "";

                if (Math.ceil(totalRecord / parseInt(perPage)) > 0) {
                    paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="logs_details_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="logs_details_table_first_1" data-pageno="1">First</a>';
                    dataDtIdx++;
                    paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="logs_details_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="logs_details_table_previous_1" data-pageno="' + (parseInt(currentPage) - 1) + '">Previous</a>';
                    paginationHtml += '<span>';
                    dataDtIdx++;

                    if (parseInt(currentPage) > 2) {
                        paginationHtml += '<a class="paginate_button" aria-controls="logs_details_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
                        if (parseInt(currentPage) > 3) {
                            paginationHtml += '<span class="ellipsis">...</span>';
                        }
                        dataDtIdx++;
                    }

                    if ((parseInt(currentPage) - 1) > 0) {
                        paginationHtml += '<a class="paginate_button" aria-controls="logs_details_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) - 1) + '">' + (parseInt(currentPage) - 1) + '</a>';
                        dataDtIdx++;
                    }

                    paginationHtml += '<a class="paginate_button current" aria-controls="logs_details_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(currentPage) + '">' + parseInt(currentPage) + '</a>';
                    dataDtIdx++;

                    if ((parseInt(currentPage) + 1) < Math.ceil(totalRecord / parseInt(perPage)) + 1) {
                        paginationHtml += '<a class="paginate_button" aria-controls="logs_details_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) + 1) + '">' + (parseInt(currentPage) + 1) + '</a>';
                        dataDtIdx++;
                    }

                    if (parseInt(currentPage) < Math.ceil(totalRecord / parseInt(perPage)) - 1) {
                        if (((parseInt(currentPage) + 3) < Math.ceil(totalRecord / parseInt(perPage)) + 1)) {
                            paginationHtml += '<span class="ellipsis">...</span>';
                        }
                        paginationHtml += '<a class="paginate_button" aria-controls="logs_details_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">' + Math.ceil(totalRecord / parseInt(perPage)) + '</a>';
                        dataDtIdx++;
                    }

                    paginationHtml += '</span>';
                    paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="logs_details_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="logs_details_table_next_1" data-pageno="' + (parseInt(currentPage) + 1) + '">Next</a>';
                    dataDtIdx++;
                    paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="logs_details_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="logs_details_table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">Last</a>';
                }

                $('body').find('#logs_details_table_paginate').html(paginationHtml);
            },
            error: function (response) {
                console.log(response);
                alert('server error');
            }
        });
    }

    $('body').on('click', '#logs_details_table a[data-uniqueId]', function (event) {
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
        $('#details-modal #details-modal-body').text(formattedData);
        $('#details-modal').modal('show');
    });
});

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
