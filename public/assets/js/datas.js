$(document).ready(async function () {
    let perPage = 50,
        currentPage = 1,
        viewFromDate = null,
        viewToDate = null,
        requestTable = null


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

    // Preset time options in minutes
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

    const query = getCookieJSON('logsCondition');

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
    }

    // Fallback to last 24 hours if nothing in cookie
    if (!viewFromDate || !viewToDate) {
        const now = new Date();
        viewToDate = now.toISOString();
        viewFromDate = new Date(now.getTime() - 1440 * 60000).toISOString(); // 24 hours
    }

    // Initialize ranges based on presets
    const ranges = {};
    for (const [label, minutes] of Object.entries(timeOptions)) {
        ranges[label] = [moment().subtract(minutes, 'minutes'), moment()];
    }

    const startMoment = moment(viewFromDate);
    const endMoment = moment(viewToDate);

    // Callback for daterangepicker
    function cb(start, end) {
        const drp = $('#datarange').data('daterangepicker');
        let matchedLabel = null;

        for (const [label, range] of Object.entries(drp.ranges)) {
            // Allow small tolerance for matching
            if (Math.abs(start.diff(range[0], 'seconds')) <= 1 && Math.abs(end.diff(range[1], 'seconds')) <= 1) {
                matchedLabel = label;
                break;
            }
        }

        if (matchedLabel) {
            $('#datarange span').html(matchedLabel);
            $('.since-time').text(matchedLabel);
        } else {
            $('#datarange span').html(`${start.format('MMMM D, YYYY HH:mm:ss')} - ${end.format('MMMM D, YYYY HH:mm:ss')}`);
            $('.since-time').text('Custom Range');
        }

        viewFromDate = start.toISOString();
        viewToDate = end.toISOString();
    }

    $('#datarange').daterangepicker({
        timePicker: true,
        timePicker24Hour: true,
        timePickerSeconds: true,
        startDate: startMoment,
        endDate: endMoment,
        locale: { format: 'MMMM D, YYYY HH:mm:ss' },
        ranges: ranges,
    }, cb);

    cb(startMoment, endMoment);

    $('#datarange').on('apply.daterangepicker', function (ev, picker) {
        if (picker.chosenLabel && picker.chosenLabel !== 'Custom Range') {
            $('#datarange span').html(`${picker.chosenLabel}`);
            $('.since-time').text(`${picker.chosenLabel}`);
        } else {
            $('#datarange span').html(
                picker.startDate.format('MMMM D, YYYY HH:mm:ss') + ' - ' + picker.endDate.format('MMMM D, YYYY HH:mm:ss')
            );
            $('.since-time').text('Custom Range');
        }
    });

    requestTable = $('#request-table').DataTable({
        aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
        iDisplayLength: perPage,
        pagingType: 'full_numbers',
        searching: false,
        columnDefs: [
            { targets: [6, 7, 8, 9], className: 'text-center' }
        ]
    })

    let logtriggerstatus = $('#select-request-trigger-status').val();
    let itemId = $('#select-data-item').val();
    await itemList(companyId = "all", projectId = "all", environmentId = "all");
    await getRequestdata(parseInt(perPage), parseInt(currentPage), viewFromDate, viewToDate, logtriggerstatus, itemId);

    $('body').on('click', '#request-table_paginate .paginate_button', async function () {
        const pageNo = parseInt($(this).data('pageno'));
        if (!pageNo || pageNo === parseInt(currentPage)) return;
        currentPage = pageNo;
        requestTable.clear();
        requestTable.destroy();
        $('#request-table tbody').empty();
        requestTable = $('#request-table').DataTable({
            aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
            iDisplayLength: perPage,
            pagingType: 'full_numbers',
            searching: false,
            columnDefs: [
                { targets: [6, 7, 8, 9], className: 'text-center' }
            ]
        });

        let logtriggerstatus = $('#select-request-trigger-status').val();
        let itemId = $('#select-data-item').val();
        await getRequestdata(parseInt(perPage), parseInt(currentPage), viewFromDate, viewToDate, logtriggerstatus, itemId);
    });

    $('body').on('change', '#request-table_length select', async function () {
        perPage = parseInt($(this).val());
        currentPage = 1;
        requestTable.clear();
        requestTable.destroy();
        requestTable = $('#request-table').DataTable({
            aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
            iDisplayLength: perPage,
            pagingType: 'full_numbers',
            searching: false,
            columnDefs: [
                { targets: [6, 7, 8, 9], className: 'text-center' }
            ]
        });

        let logtriggerstatus = $('#select-request-trigger-status').val();
        let itemId = $('#select-data-item').val();
        await getRequestdata(parseInt(perPage), parseInt(currentPage), viewFromDate, viewToDate, logtriggerstatus, itemId);
    });

    $('body').on('click', '#search-request-button', function () {
        perPage = 50;
        currentPage = 1;
        let logtriggerstatus = $('#select-request-trigger-status').val();
        let itemId = $('#select-data-item').val();
        const timeLabel = $('.since-time').text();
		let time = '';

		if (timeLabel.includes('Since')) {
			time = timeLabel.replace('Since ', '').replace(' ago', '');
		} else {
			time = timeLabel; // in case of custom range
		}
        const queryObj = {
            ...query,
            time,
            viewFromDate,
            viewToDate
        };  
        setCookie('logsCondition',JSON.stringify(queryObj));
        getRequestdata(perPage, currentPage, viewFromDate, viewToDate, logtriggerstatus, itemId)
    });

    function resetSelect($select, placeholder = '-- Please Select --') {
        $select.empty().append(`<option value="">${placeholder}</option>`);
    }

    async function itemList(companyId, projectId, environmentId) {
        return getAllItemList(companyId, projectId, environmentId).then(responseItems => {
            if (responseItems.status === 1) {
                const $selectItems = $('#select-data-item');
                resetSelect($selectItems);

                $('<option>', { value: 'all', text: 'All', selected: true }).appendTo($selectItems);

                $.each(responseItems.data, function (index, item) {
                    $('<option>', {
                        value: item._id,
                        text: item.ItemName,
                        'data-name': item.name
                    }).appendTo($selectItems);
                });

                return true;
            }
            throw new Error("Item fetch failed");
        });
    }


    async function getRequestdata(perPage, currentPage, viewFromDate, viewToDate, logtriggerstatus, itemId) {
        $('#request-tabl tbody').empty();
        $('#request-tabl tbody').html('<tr class="odd"><td valign="top" colspan="17" class="dataTables_empty"><div class="tableloader"></div></td></tr>');
        await $.ajax({
            url: '/logs/request_by_log',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ limit: perPage, page: currentPage, logtriggerstatus, itemId, viewFromDate, viewToDate }),
            success: function (response) {
                let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
                let totalRecord = parseInt(response.total);

                if (response.data.length <= 0) {
                    $('#request-table tbody').html('<tr class="odd"><td valign="top" colspan="17" class="dataTables_empty">No data available in table</td></tr>');
                }

                requestTable.clear();

                $.each(response.data, function (index, data) {
                    let request = "";
                    let transformed_request = "";
                    let response = "";
                    let transformed_response = "";
                    let outbound_entrypoint = "";
                    let log_description = "";
                    let request_validation = "";
                    let response_validation = "";
                    let trigger_rule = "";
                    let status = "";
                    let httpStatus = "";
                    let response_filter = "";
                    let request_filter = "";

                    if (data?.inboundUserPosting !== "not_execute") { request = data?.inboundUserPosting; }
                    if (data?.outboundMappedDataRequest !== "not_execute") {
                        transformed_request = {
                            ...data?.outboundMappedDataRequest,
                            message: "Triggered"
                        };
                    } else {
                        transformed_request = { message: "No Mapping" };
                    }
                    if (data?.outboundApiResponse !== "not_execute") { response = data?.outboundApiResponse; }

                    if (data?.outboundApiResponse !== "not_execute") {
                        response = {
                            ...data?.outboundApiResponse,
                        };
                    } else {
                        response = { message: "No" };
                    }

                    if (data?.outboundMappedDataResponse !== "not_execute") {
                        transformed_response = {
                            ...data?.outboundMappedDataResponse,
                            message: "Triggered"
                        };
                    } else {
                        transformed_response = { message: "No Mapping" };
                    }
                    if (data?.request_filter !== "not_execute") {
                        request_filter = {
                            ...data?.request_filter,
                        };
                    } else {
                        request_filter = { message: "No" };
                    }
                    if (data?.response_filter !== "not_execute") {
                        response_filter = {
                            ...data?.response_filter,
                        };
                    } else {
                        response_filter = { message: "No" };
                    }
                    if (data?.outboundEntrypoint !== "not_execute") { outbound_entrypoint = data?.outboundEntrypoint; } else { outbound_entrypoint = { message: "No" }; }
                    if (data?.logDescription !== "not_execute") { log_description = data?.logDescription; }
                    if (data?.request_validation !== "not_execute") { request_validation = data?.request_validation; }
                    if (data?.response_validation !== "not_execute") { response_validation = data?.response_validation; }
                    // if (data?.trigger_rule !== "not_execute") { trigger_rule = data?.trigger_rule; } else { trigger_rule = { message: "No" }; }
                    if (data?.outboundTrigger || response) { status = "Triggered"; } else { status = "Not Triggered"; }
                    if (response) { httpStatus = response.httpStatus; } else { httpStatus = "Not Triggered"; }

                    if (data?.trigger_rule !== "not_execute") {
                        trigger_rule = extractValidationResult(data.trigger_rule || []);
                    }

                    // const logDescriptionText = (data?.log_description?.datas || '').replace(/\n/g, '<br>');
                    const logDescriptionText = (log_description?.datas || '').replace(/\n/g, '<br>');

                    const safeLogDescription = logDescriptionText
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');

                    // Apply underline class only if description exists
                    const clickableLogDescription = `<span>${logDescriptionText}</span>`;

                    let $button_group_request = '<div class="btn-group-vertical text-center" role="group">';
                    if (request?.datas) {
                        $button_group_request += createViewButtonForRequest(request.datas);
                    }
                    $button_group_request += '</div>';

                    let $button_group_transformed_request = '';
                    $button_group_transformed_request = '<div class="btn-group-vertical text-center" role="group">';
                    if (transformed_request && transformed_request.datas) {
                        $button_group_transformed_request += createViewButtonForRequest(transformed_request.datas);
                    }
                    if (transformed_request && transformed_request.message) {
                        $button_group_transformed_request += `<span class="text-center mt-1 w-100">${transformed_request.message}</span>`;
                    }
                    $button_group_transformed_request += '</div>';

                    let $button_group_response = '<div class="btn-group-vertical text-center" role="group">';
                    if (response?.datas) {
                        $button_group_response += createViewButtonForRequest(response.datas);
                    }
                    if (response && response.message) {
                        $button_group_response += `<span class="text-center mt-1 w-100">${response.message}</span>`;
                    }
                    $button_group_response += '</div>';

                    let $button_group_transformed_response = '<div class="btn-group-vertical text-center" role="group">';
                    if (transformed_response && transformed_response?.datas) {
                        $button_group_transformed_response += createViewButtonForRequest(transformed_response.datas);
                    }
                    if (transformed_response && transformed_response.message) {
                        $button_group_transformed_response += `<span class="text-center mt-1 w-100">${transformed_response.message}</span>`;
                    }
                    $button_group_transformed_response += '</div>';

                    let $button_group_curl_base = '<div class="btn-group-vertical text-center w-100" role="group">';
                    if (outbound_entrypoint?.datas) {
                        $button_group_curl_base += createViewButtonForRequest(outbound_entrypoint.datas, "curl");
                    }
                    if (outbound_entrypoint?.message) {
                        $button_group_curl_base += `<span class="text-center mt-1 w-100">${outbound_entrypoint.message}</span>`;
                    }
                    $button_group_curl_base += '</div>';

                    let $button_group_log_description = '<div class="btn-group-vertical text-center" role="group">';
                    if (log_description?.datas) {
                        $button_group_log_description += createViewButtonForRequest(log_description.datas);
                    }
                    $button_group_log_description += '</div>';

                    let $button_group_request_validation = '<div class="btn-group-vertical text-center" role="group">';
                    if (request_validation?.errorLog?.datas) {
                        $button_group_request_validation += createViewButtonForRequest(request_validation?.errorLog?.datas);
                    }
                    if (request_validation?.message) {
                        $button_group_request_validation += `<span class="text-center mt-1 w-100">${request_validation?.message || ''}</span>`;
                    }
                    $button_group_request_validation += '</div>';

                    let $button_group_response_validation = '<div class="btn-group-vertical text-center" role="group">';
                    if (response_validation?.errorLog?.datas) {
                        $button_group_response_validation += createViewButtonForRequest(response_validation?.errorLog?.datas);
                    }
                    if (response_validation?.message) {
                        $button_group_response_validation += `<span class="text-center mt-1 w-100">${response_validation?.message || ''}</span>`;
                    }
                    $button_group_response_validation += '</div>';

                    let $button_group_trigger_rule = '<div class="btn-group-vertical text-center" role="group">';
                    if (trigger_rule?.datas) {
                        $button_group_trigger_rule += createViewButtonForRequest(trigger_rule.datas);
                    }
                    if (trigger_rule?.message) {
                        $button_group_trigger_rule += `<span class="text-center mt-1 w-100">${trigger_rule?.message || ''}</span>`;
                    }
                    $button_group_trigger_rule += '</div>';

                    let $button_group_request_filter = '<div class="btn-group-vertical text-center" role="group">';
                    if (request_filter?.datas) {
                        $button_group_request_filter += createViewButtonForRequest(request_filter.datas);
                    }
                    if (request_filter?.message) {
                        $button_group_request_filter += `<span class="text-center mt-1 w-100">${request_filter?.message || ''}</span>`;
                    }
                    $button_group_request_filter += '</div>';

                    let $button_group_response_filter = '<div class="btn-group-vertical text-center" role="group">';
                    if (response_filter?.datas) {
                        $button_group_response_filter += createViewButtonForRequest(response_filter.datas);
                    }
                    if (response_filter?.message) {
                        $button_group_response_filter += `<span class="text-center mt-1 w-100">${response_filter?.message || ''}</span>`;
                    }
                    $button_group_response_filter += '</div>';

                    requestTable.row.add([
                        counter++,
                        data.request_id,
                        data.itemName,
                        data.timeDiffMs || 0,
                        status,
                        httpStatus || '',
                        $button_group_curl_base,
                        $button_group_request,
                        $button_group_request_filter,
                        $button_group_request_validation,
                        $button_group_transformed_request,
                        $button_group_trigger_rule,
                        clickableLogDescription,
                        $button_group_response,
                        $button_group_response_filter,
                        $button_group_response_validation,
                        $button_group_transformed_response,

                    ]).draw(false);
                })

                $('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
                let startEntry = (parseInt(currentPage) == 1) ? 1 : ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1);
                let endEntry = (parseInt(currentPage) == 1) ? parseInt(perPage) : (parseInt(perPage) * parseInt(currentPage));
                endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

                if (totalRecord == 0) {
                    startEntry = 0;
                }

                let showpage = 'Showing ' + startEntry + ' to ' + endEntry + ' of ' + totalRecord + ' entries';
                $('body').find('#request-table_info').html(showpage);

                renderPaginationRequest(perPage, currentPage, totalRecord);

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

    function extractValidationResult(logs) {
        if (!logs || !logs.length) return { message: "No" };

        const sortedLogs = [...logs].sort((a, b) => {
            const dateDiff = new Date(a.createdAt) - new Date(b.createdAt);
            if (dateDiff !== 0) return dateDiff;
            return a._id.localeCompare(b._id); // tie-breaker if createdAt is same
        });

        let lastInboundLog = null;
        let lastInboundIndex = -1;

        for (let i = 0; i < sortedLogs.length; i++) {
            const log = sortedLogs[i];
            if (log.action === "Inbound Validation Apply" &&
                (log.description.endsWith("= Fail") || log.description.endsWith("= Pass"))) {
                lastInboundLog = log;
                lastInboundIndex = i;
            }
        }

        if (!lastInboundLog) {
            return { message: "No", beforeInboundLogs: sortedLogs, lastInboundLog: null, logsAfterInbound: [] };
        }

        const beforeInboundLogs = sortedLogs.slice(0, lastInboundIndex + 1);
        const logsAfterInbound = sortedLogs.slice(lastInboundIndex + 1);

        const matchedLog = logsAfterInbound.find(log =>
            log.description.includes("matched to SKIP") ||
            log.description.includes("matched to STOP")
        );

        if (matchedLog) {
            if (matchedLog.description.includes("matched to SKIP")) {
                return {
                    message: "matched to SKIP",
                    datas: lastInboundLog.description,
                    matchedLog,
                };
            }
            if (matchedLog.description.includes("matched to STOP")) {
                return {
                    message: "matched to STOP",
                    datas: lastInboundLog.description,
                };
            }
        }

        const message = lastInboundLog.description.endsWith("= Fail") ? "Fail" : "Pass";

        return {
            message,
            datas: lastInboundLog.description
        };
    }

    function createViewButtonForRequest(datas, request) {
        if (!datas) return '';

        let parsedDatas;
        try {
            parsedDatas = typeof datas === 'string' ? JSON.parse(datas) : datas;
        } catch (e) {
            parsedDatas = datas;
        }

        // Safely stringify and escape quotes for HTML attribute
        const requestJson = JSON.stringify(parsedDatas).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

        return `<button type="button" class="btn btn-outline-secondary" data-toggle="tooltip" title="View" data-request='${requestJson}' data-curl='${request}' onclick="viewItemLogDetailsModelForRequest(this.getAttribute('data-request'), this.getAttribute('data-curl'))">
		<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>`;
    }

    function renderPaginationRequest(perPage, currentPage, totalRecord) {
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

        $('#request-table_paginate').html(paginationHtml);
    }
})

function viewItemLogDetailsModelForRequest(datasString, curl) {
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