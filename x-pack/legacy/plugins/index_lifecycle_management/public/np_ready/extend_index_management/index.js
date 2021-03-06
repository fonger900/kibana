/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React from 'react';
import { get, every, any } from 'lodash';
import { i18n } from '@kbn/i18n';
import { EuiSearchBar } from '@elastic/eui';

import { extensionsService } from '../../../../index_management/public';
import { init as initUiMetric } from '../application/services/ui_metric';
import { init as initNotification } from '../application/services/notification';
import { retryLifecycleForIndex } from '../application/services/api';
import { IndexLifecycleSummary } from './components/index_lifecycle_summary';
import { AddLifecyclePolicyConfirmModal } from './components/add_lifecycle_confirm_modal';
import { RemoveLifecyclePolicyConfirmModal } from './components/remove_lifecycle_confirm_modal';

const stepPath = 'ilm.step';

export const retryLifecycleActionExtension = ({
  indices,
  usageCollection,
  toasts,
  fatalErrors,
}) => {
  // These are hacks that we can remove once the New Platform migration is done. They're needed here
  // because API requests and API errors require them.
  const getLegacyReporter = appName => (type, name) => {
    usageCollection.reportUiStats(appName, type, name);
  };

  initUiMetric(getLegacyReporter);
  initNotification(toasts, fatalErrors);

  const allHaveErrors = every(indices, index => {
    return index.ilm && index.ilm.failed_step;
  });
  if (!allHaveErrors) {
    return null;
  }
  const indexNames = indices.map(({ name }) => name);
  return {
    requestMethod: retryLifecycleForIndex,
    icon: 'play',
    indexNames: [indexNames],
    buttonLabel: i18n.translate('xpack.indexLifecycleMgmt.retryIndexLifecycleActionButtonLabel', {
      defaultMessage: 'Retry lifecycle step',
    }),
    successMessage: i18n.translate(
      'xpack.indexLifecycleMgmt.retryIndexLifecycleAction.retriedLifecycleMessage',
      {
        defaultMessage: 'Called retry lifecycle step for: {indexNames}',
        values: { indexNames: indexNames.map(indexName => `"${indexName}"`).join(', ') },
      }
    ),
  };
};

export const removeLifecyclePolicyActionExtension = ({
  indices,
  reloadIndices,
  createUiStatsReporter,
  toasts,
  fatalErrors,
  httpClient,
}) => {
  // These are hacks that we can remove once the New Platform migration is done. They're needed here
  // because API requests and API errors require them.
  initUiMetric(createUiStatsReporter);
  initNotification(toasts, fatalErrors);

  const allHaveIlm = every(indices, index => {
    return index.ilm && index.ilm.managed;
  });
  if (!allHaveIlm) {
    return null;
  }
  const indexNames = indices.map(({ name }) => name);
  return {
    renderConfirmModal: closeModal => {
      return (
        <RemoveLifecyclePolicyConfirmModal
          indexNames={indexNames}
          closeModal={closeModal}
          httpClient={httpClient}
          toasts={toasts}
          reloadIndices={reloadIndices}
        />
      );
    },
    icon: 'stopFilled',
    indexNames: [indexNames],
    buttonLabel: i18n.translate('xpack.indexLifecycleMgmt.removeIndexLifecycleActionButtonLabel', {
      defaultMessage: 'Remove lifecycle policy',
    }),
  };
};

export const addLifecyclePolicyActionExtension = ({
  indices,
  reloadIndices,
  createUiStatsReporter,
  toasts,
  fatalErrors,
  httpClient,
}) => {
  // These are hacks that we can remove once the New Platform migration is done. They're needed here
  // because API requests and API errors require them.
  initUiMetric(createUiStatsReporter);
  initNotification(toasts, fatalErrors);

  if (indices.length !== 1) {
    return null;
  }
  const index = indices[0];
  const hasIlm = index.ilm && index.ilm.managed;

  if (hasIlm) {
    return null;
  }
  const indexName = index.name;
  return {
    renderConfirmModal: closeModal => {
      return (
        <AddLifecyclePolicyConfirmModal
          indexName={indexName}
          closeModal={closeModal}
          httpClient={httpClient}
          toasts={toasts}
          index={index}
          reloadIndices={reloadIndices}
        />
      );
    },
    icon: 'plusInCircle',
    buttonLabel: i18n.translate('xpack.indexLifecycleMgmt.addLifecyclePolicyActionButtonLabel', {
      defaultMessage: 'Add lifecycle policy',
    }),
  };
};

export const ilmBannerExtension = indices => {
  const { Query } = EuiSearchBar;
  if (!indices.length) {
    return null;
  }
  const indicesWithLifecycleErrors = indices.filter(index => {
    return get(index, stepPath) === 'ERROR';
  });
  const numIndicesWithLifecycleErrors = indicesWithLifecycleErrors.length;
  if (!numIndicesWithLifecycleErrors) {
    return null;
  }
  return {
    type: 'warning',
    filter: Query.parse(`${stepPath}:ERROR`),
    filterLabel: i18n.translate('xpack.indexLifecycleMgmt.indexMgmtBanner.filterLabel', {
      defaultMessage: 'Show errors',
    }),
    title: i18n.translate('xpack.indexLifecycleMgmt.indexMgmtBanner.errorMessage', {
      defaultMessage: `{ numIndicesWithLifecycleErrors, number}
          {numIndicesWithLifecycleErrors, plural, one {index has} other {indices have} }
          lifecycle errors`,
      values: { numIndicesWithLifecycleErrors },
    }),
  };
};

export const ilmSummaryExtension = index => {
  return <IndexLifecycleSummary index={index} />;
};

export const ilmFilterExtension = indices => {
  const hasIlm = any(indices, index => index.ilm && index.ilm.managed);
  if (!hasIlm) {
    return [];
  } else {
    return [
      {
        type: 'field_value_selection',
        name: i18n.translate('xpack.indexLifecycleMgmt.indexMgmtFilter.lifecycleStatusLabel', {
          defaultMessage: 'Lifecycle status',
        }),
        multiSelect: false,
        field: 'ilm.managed',
        options: [
          {
            value: true,
            view: i18n.translate('xpack.indexLifecycleMgmt.indexMgmtFilter.managedLabel', {
              defaultMessage: 'Managed',
            }),
          },
          {
            value: false,
            view: i18n.translate('xpack.indexLifecycleMgmt.indexMgmtFilter.unmanagedLabel', {
              defaultMessage: 'Unmanaged',
            }),
          },
        ],
      },
    ];
  }
};

export const addAllExtensions = () => {
  extensionsService.addAction(retryLifecycleActionExtension);
  extensionsService.addAction(removeLifecyclePolicyActionExtension);
  extensionsService.addAction(addLifecyclePolicyActionExtension);

  extensionsService.addBanner(ilmBannerExtension);
  extensionsService.addSummary(ilmSummaryExtension);
  extensionsService.addFilter(ilmFilterExtension);
};
