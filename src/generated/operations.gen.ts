// Generated from the pinned document by scripts/api.ts. Every method supplies its own connection.
import * as sdk from "./sdk.gen";
import type * as types from "./types.gen";
import type { Client } from "./client";
export function bindOperations(
  invoke: <T>(operation: (client: Client) => Promise<T>) => Promise<T>,
) {
  return {
    appAccessRequest: (
      options: Omit<types.AppAccessRequestData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.appAccessRequest({ ...options, client, throwOnError: true })),
    appConnection: (options: Omit<types.AppConnectionData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.appConnection({ ...options, client, throwOnError: true })),
    appOperationOutcome: (
      options: Omit<types.AppOperationOutcomeData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.appOperationOutcome({ ...options, client, throwOnError: true })),
    appResources: (options: Omit<types.AppResourcesData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.appResources({ ...options, client, throwOnError: true })),
    appStream: (options: Omit<types.AppStreamData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.appStream({ ...options, client, throwOnError: true })),
    appSummary: (options: Omit<types.AppSummaryData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.appSummary({ ...options, client, throwOnError: true })),
    auditEventList: (options: Omit<types.AuditEventListData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.auditEventList({ ...options, client, throwOnError: true })),
    auditEventRead: (options: Omit<types.AuditEventReadData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.auditEventRead({ ...options, client, throwOnError: true })),
    authChallengePasskeyBegin: (
      options: Omit<types.AuthChallengePasskeyBeginData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) => sdk.authChallengePasskeyBegin({ ...options, client, throwOnError: true })),
    authChallengePasskeyVerify: (
      options: Omit<types.AuthChallengePasskeyVerifyData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) =>
        sdk.authChallengePasskeyVerify({ ...options, client, throwOnError: true }),
      ),
    authChallengeVerify: (
      options: Omit<types.AuthChallengeVerifyData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authChallengeVerify({ ...options, client, throwOnError: true })),
    authFactorList: (options: Omit<types.AuthFactorListData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authFactorList({ ...options, client, throwOnError: true })),
    authFactorPasskeyBegin: (
      options: Omit<types.AuthFactorPasskeyBeginData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authFactorPasskeyBegin({ ...options, client, throwOnError: true })),
    authFactorPasskeyFinish: (
      options: Omit<types.AuthFactorPasskeyFinishData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) => sdk.authFactorPasskeyFinish({ ...options, client, throwOnError: true })),
    authRecoveryCodesRotate: (
      options: Omit<types.AuthRecoveryCodesRotateData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) => sdk.authRecoveryCodesRotate({ ...options, client, throwOnError: true })),
    authFactorTotpBegin: (
      options: Omit<types.AuthFactorTotpBeginData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authFactorTotpBegin({ ...options, client, throwOnError: true })),
    authFactorTotpFinish: (
      options: Omit<types.AuthFactorTotpFinishData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authFactorTotpFinish({ ...options, client, throwOnError: true })),
    authFactorWithdraw: (
      options: Omit<types.AuthFactorWithdrawData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authFactorWithdraw({ ...options, client, throwOnError: true })),
    authLogin: (options: Omit<types.AuthLoginData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authLogin({ ...options, client, throwOnError: true })),
    authLoginPasskeyBegin: (
      options: Omit<types.AuthLoginPasskeyBeginData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authLoginPasskeyBegin({ ...options, client, throwOnError: true })),
    authLoginPasskeyVerify: (
      options: Omit<types.AuthLoginPasskeyVerifyData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authLoginPasskeyVerify({ ...options, client, throwOnError: true })),
    authLogout: (options: Omit<types.AuthLogoutData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authLogout({ ...options, client, throwOnError: true })),
    authMe: (options: Omit<types.AuthMeData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authMe({ ...options, client, throwOnError: true })),
    authOidcCallback: (
      options: Omit<types.AuthOidcCallbackData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authOidcCallback({ ...options, client, throwOnError: true })),
    authOidcStart: (options: Omit<types.AuthOidcStartData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authOidcStart({ ...options, client, throwOnError: true })),
    authPasswordChange: (
      options: Omit<types.AuthPasswordChangeData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authPasswordChange({ ...options, client, throwOnError: true })),
    authPasswordReset: (
      options: Omit<types.AuthPasswordResetData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authPasswordReset({ ...options, client, throwOnError: true })),
    authRoleList: (options: Omit<types.AuthRoleListData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authRoleList({ ...options, client, throwOnError: true })),
    authRoleSet: (options: Omit<types.AuthRoleSetData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authRoleSet({ ...options, client, throwOnError: true })),
    authSamlCallback: (
      options: Omit<types.AuthSamlCallbackData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authSamlCallback({ ...options, client, throwOnError: true })),
    authSamlMetadata: (
      options: Omit<types.AuthSamlMetadataData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authSamlMetadata({ ...options, client, throwOnError: true })),
    authSamlStart: (options: Omit<types.AuthSamlStartData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authSamlStart({ ...options, client, throwOnError: true })),
    authSessionList: (options: Omit<types.AuthSessionListData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authSessionList({ ...options, client, throwOnError: true })),
    authSessionRevokeAll: (
      options: Omit<types.AuthSessionRevokeAllData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authSessionRevokeAll({ ...options, client, throwOnError: true })),
    authSessionRevoke: (
      options: Omit<types.AuthSessionRevokeData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authSessionRevoke({ ...options, client, throwOnError: true })),
    authPasskeySignInSet: (
      options: Omit<types.AuthPasskeySignInSetData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authPasskeySignInSet({ ...options, client, throwOnError: true })),
    authTokenList: (options: Omit<types.AuthTokenListData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authTokenList({ ...options, client, throwOnError: true })),
    authTokenIssue: (options: Omit<types.AuthTokenIssueData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authTokenIssue({ ...options, client, throwOnError: true })),
    authTokenRevokeSelf: (
      options: Omit<types.AuthTokenRevokeSelfData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authTokenRevokeSelf({ ...options, client, throwOnError: true })),
    authTokenRevoke: (options: Omit<types.AuthTokenRevokeData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authTokenRevoke({ ...options, client, throwOnError: true })),
    billingPlanList: (options: Omit<types.BillingPlanListData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.billingPlanList({ ...options, client, throwOnError: true })),
    billingPlanRead: (options: Omit<types.BillingPlanReadData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.billingPlanRead({ ...options, client, throwOnError: true })),
    billingSubscriptionRead: (
      options: Omit<types.BillingSubscriptionReadData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) => sdk.billingSubscriptionRead({ ...options, client, throwOnError: true })),
    billingSubscriptionCancel: (
      options: Omit<types.BillingSubscriptionCancelData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) => sdk.billingSubscriptionCancel({ ...options, client, throwOnError: true })),
    billingSubscriptionSubscribe: (
      options: Omit<types.BillingSubscriptionSubscribeData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) =>
        sdk.billingSubscriptionSubscribe({ ...options, client, throwOnError: true }),
      ),
    changeProposalList: (
      options: Omit<types.ChangeProposalListData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.changeProposalList({ ...options, client, throwOnError: true })),
    changeProposalPropose: (
      options: Omit<types.ChangeProposalProposeData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.changeProposalPropose({ ...options, client, throwOnError: true })),
    changeProposalRead: (
      options: Omit<types.ChangeProposalReadData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.changeProposalRead({ ...options, client, throwOnError: true })),
    changeProposalApply: (
      options: Omit<types.ChangeProposalApplyData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.changeProposalApply({ ...options, client, throwOnError: true })),
    changeProposalReview: (
      options: Omit<types.ChangeProposalReviewData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.changeProposalReview({ ...options, client, throwOnError: true })),
    changeProposalWithdraw: (
      options: Omit<types.ChangeProposalWithdrawData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.changeProposalWithdraw({ ...options, client, throwOnError: true })),
    contentContentList: (
      options: Omit<types.ContentContentListData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.contentContentList({ ...options, client, throwOnError: true })),
    contentContentCreate: (
      options: Omit<types.ContentContentCreateData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.contentContentCreate({ ...options, client, throwOnError: true })),
    contentContentDelete: (
      options: Omit<types.ContentContentDeleteData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.contentContentDelete({ ...options, client, throwOnError: true })),
    contentContentRead: (
      options: Omit<types.ContentContentReadData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.contentContentRead({ ...options, client, throwOnError: true })),
    contentContentUpdate: (
      options: Omit<types.ContentContentUpdateData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.contentContentUpdate({ ...options, client, throwOnError: true })),
    contentContentArchive: (
      options: Omit<types.ContentContentArchiveData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.contentContentArchive({ ...options, client, throwOnError: true })),
    contentContentPublish: (
      options: Omit<types.ContentContentPublishData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.contentContentPublish({ ...options, client, throwOnError: true })),
    contentContentRestore: (
      options: Omit<types.ContentContentRestoreData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.contentContentRestore({ ...options, client, throwOnError: true })),
    contentContentReviewTranslation: (
      options: Omit<types.ContentContentReviewTranslationData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) =>
        sdk.contentContentReviewTranslation({ ...options, client, throwOnError: true }),
      ),
    contentContentSuggestTranslation: (
      options: Omit<types.ContentContentSuggestTranslationData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) =>
        sdk.contentContentSuggestTranslation({ ...options, client, throwOnError: true }),
      ),
    contentContentTranslate: (
      options: Omit<types.ContentContentTranslateData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) => sdk.contentContentTranslate({ ...options, client, throwOnError: true })),
    contentContentUnpublish: (
      options: Omit<types.ContentContentUnpublishData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) => sdk.contentContentUnpublish({ ...options, client, throwOnError: true })),
    contentContentUntranslate: (
      options: Omit<types.ContentContentUntranslateData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) => sdk.contentContentUntranslate({ ...options, client, throwOnError: true })),
    contentContentVersions: (
      options: Omit<types.ContentContentVersionsData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.contentContentVersions({ ...options, client, throwOnError: true })),
    fileFileList: (options: Omit<types.FileFileListData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileList({ ...options, client, throwOnError: true })),
    fileFileUpload: (options: Omit<types.FileFileUploadData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileUpload({ ...options, client, throwOnError: true })),
    fileFileErase: (options: Omit<types.FileFileEraseData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileErase({ ...options, client, throwOnError: true })),
    fileFileDelete: (options: Omit<types.FileFileDeleteData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileDelete({ ...options, client, throwOnError: true })),
    fileFileRead: (options: Omit<types.FileFileReadData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileRead({ ...options, client, throwOnError: true })),
    fileFileAltCommand: (
      options: Omit<types.FileFileAltCommandData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.fileFileAltCommand({ ...options, client, throwOnError: true })),
    fileFileAlt: (options: Omit<types.FileFileAltData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileAlt({ ...options, client, throwOnError: true })),
    fileFileContent: (options: Omit<types.FileFileContentData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileContent({ ...options, client, throwOnError: true })),
    fileFileContentHead: (
      options: Omit<types.FileFileContentHeadData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.fileFileContentHead({ ...options, client, throwOnError: true })),
    fileFileGrant: (options: Omit<types.FileFileGrantData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileGrant({ ...options, client, throwOnError: true })),
    fileFileRelease: (options: Omit<types.FileFileReleaseData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileRelease({ ...options, client, throwOnError: true })),
    fileFileRetain: (options: Omit<types.FileFileRetainData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileRetain({ ...options, client, throwOnError: true })),
    fileFileUses: (options: Omit<types.FileFileUsesData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileUses({ ...options, client, throwOnError: true })),
    fileQuotaRead: (options: Omit<types.FileQuotaReadData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileQuotaRead({ ...options, client, throwOnError: true })),
    notificationNotificationList: (
      options: Omit<types.NotificationNotificationListData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) =>
        sdk.notificationNotificationList({ ...options, client, throwOnError: true }),
      ),
    notificationDeviceList: (
      options: Omit<types.NotificationDeviceListData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.notificationDeviceList({ ...options, client, throwOnError: true })),
    notificationDeviceRegister: (
      options: Omit<types.NotificationDeviceRegisterData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) =>
        sdk.notificationDeviceRegister({ ...options, client, throwOnError: true }),
      ),
    notificationDeviceRemove: (
      options: Omit<types.NotificationDeviceRemoveData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) => sdk.notificationDeviceRemove({ ...options, client, throwOnError: true })),
    notificationNotificationRead: (
      options: Omit<types.NotificationNotificationReadData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) =>
        sdk.notificationNotificationRead({ ...options, client, throwOnError: true }),
      ),
    billingPlanCreate: (
      options: Omit<types.BillingPlanCreateData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.billingPlanCreate({ ...options, client, throwOnError: true })),
    billingPlanDelete: (
      options: Omit<types.BillingPlanDeleteData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.billingPlanDelete({ ...options, client, throwOnError: true })),
    billingPlanUpdate: (
      options: Omit<types.BillingPlanUpdateData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.billingPlanUpdate({ ...options, client, throwOnError: true })),
    tenantTenantList: (
      options: Omit<types.TenantTenantListData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantList({ ...options, client, throwOnError: true })),
    tenantTenantCreate: (
      options: Omit<types.TenantTenantCreateData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantCreate({ ...options, client, throwOnError: true })),
    tenantTenantRead: (
      options: Omit<types.TenantTenantReadData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantRead({ ...options, client, throwOnError: true })),
    tenantTenantDelete: (
      options: Omit<types.TenantTenantDeleteData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantDelete({ ...options, client, throwOnError: true })),
    tenantTenantAddHost: (
      options: Omit<types.TenantTenantAddHostData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantAddHost({ ...options, client, throwOnError: true })),
    tenantTenantRemoveHost: (
      options: Omit<types.TenantTenantRemoveHostData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantRemoveHost({ ...options, client, throwOnError: true })),
    tenantTenantInvite: (
      options: Omit<types.TenantTenantInviteData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantInvite({ ...options, client, throwOnError: true })),
    tenantTenantSetLocale: (
      options: Omit<types.TenantTenantSetLocaleData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantSetLocale({ ...options, client, throwOnError: true })),
    tenantTenantSetOidc: (
      options: Omit<types.TenantTenantSetOidcData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantSetOidc({ ...options, client, throwOnError: true })),
    tenantTenantClearOidc: (
      options: Omit<types.TenantTenantClearOidcData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantClearOidc({ ...options, client, throwOnError: true })),
    tenantTenantReactivate: (
      options: Omit<types.TenantTenantReactivateData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantReactivate({ ...options, client, throwOnError: true })),
    tenantTenantRename: (
      options: Omit<types.TenantTenantRenameData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantRename({ ...options, client, throwOnError: true })),
    tenantTenantSetSaml: (
      options: Omit<types.TenantTenantSetSamlData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantSetSaml({ ...options, client, throwOnError: true })),
    tenantTenantClearSaml: (
      options: Omit<types.TenantTenantClearSamlData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantClearSaml({ ...options, client, throwOnError: true })),
    tenantTenantSuspend: (
      options: Omit<types.TenantTenantSuspendData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantSuspend({ ...options, client, throwOnError: true })),
    authMailDelivery: (
      options: Omit<types.AuthMailDeliveryData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authMailDelivery({ ...options, client, throwOnError: true })),
    authPasswordForgot: (
      options: Omit<types.AuthPasswordForgotData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authPasswordForgot({ ...options, client, throwOnError: true })),
    authRegister: (options: Omit<types.AuthRegisterData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authRegister({ ...options, client, throwOnError: true })),
    authResendVerification: (
      options: Omit<types.AuthResendVerificationData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.authResendVerification({ ...options, client, throwOnError: true })),
    authVerifyEmail: (options: Omit<types.AuthVerifyEmailData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authVerifyEmail({ ...options, client, throwOnError: true })),
    contentContentPublic: (
      options: Omit<types.ContentContentPublicData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.contentContentPublic({ ...options, client, throwOnError: true })),
    fileFilePublic: (options: Omit<types.FileFilePublicData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFilePublic({ ...options, client, throwOnError: true })),
    fileFilePublicHead: (
      options: Omit<types.FileFilePublicHeadData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.fileFilePublicHead({ ...options, client, throwOnError: true })),
    siteSettingsPublic: (
      options: Omit<types.SiteSettingsPublicData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.siteSettingsPublic({ ...options, client, throwOnError: true })),
    subjectExportBundle: (
      options: Omit<types.SubjectExportBundleData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.subjectExportBundle({ ...options, client, throwOnError: true })),
    scimGroupMappingsList: (
      options: Omit<types.ScimGroupMappingsListData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.scimGroupMappingsList({ ...options, client, throwOnError: true })),
    scimGroupMappingWrite: (
      options: Omit<types.ScimGroupMappingWriteData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.scimGroupMappingWrite({ ...options, client, throwOnError: true })),
    siteSettingsRead: (
      options: Omit<types.SiteSettingsReadData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.siteSettingsRead({ ...options, client, throwOnError: true })),
    siteSettingsSave: (
      options: Omit<types.SiteSettingsSaveData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.siteSettingsSave({ ...options, client, throwOnError: true })),
    subjectEraseRequest: (
      options: Omit<types.SubjectEraseRequestData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.subjectEraseRequest({ ...options, client, throwOnError: true })),
    subjectExportRequestMine: (
      options: Omit<types.SubjectExportRequestMineData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) => sdk.subjectExportRequestMine({ ...options, client, throwOnError: true })),
    subjectExportRequestFor: (
      options: Omit<types.SubjectExportRequestForData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) => sdk.subjectExportRequestFor({ ...options, client, throwOnError: true })),
    subjectExportLinkFor: (
      options: Omit<types.SubjectExportLinkForData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.subjectExportLinkFor({ ...options, client, throwOnError: true })),
    subjectExportReadMine: (
      options: Omit<types.SubjectExportReadMineData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.subjectExportReadMine({ ...options, client, throwOnError: true })),
    subjectExportLinkMine: (
      options: Omit<types.SubjectExportLinkMineData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.subjectExportLinkMine({ ...options, client, throwOnError: true })),
    taskTaskList: (options: Omit<types.TaskTaskListData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.taskTaskList({ ...options, client, throwOnError: true })),
    taskTaskCreate: (options: Omit<types.TaskTaskCreateData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.taskTaskCreate({ ...options, client, throwOnError: true })),
    taskTaskDelete: (options: Omit<types.TaskTaskDeleteData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.taskTaskDelete({ ...options, client, throwOnError: true })),
    taskTaskRead: (options: Omit<types.TaskTaskReadData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.taskTaskRead({ ...options, client, throwOnError: true })),
    taskTaskUpdate: (options: Omit<types.TaskTaskUpdateData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.taskTaskUpdate({ ...options, client, throwOnError: true })),
    taskTaskAssign: (options: Omit<types.TaskTaskAssignData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.taskTaskAssign({ ...options, client, throwOnError: true })),
    taskTaskCheckSla: (
      options: Omit<types.TaskTaskCheckSlaData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.taskTaskCheckSla({ ...options, client, throwOnError: true })),
    taskTaskResolve: (options: Omit<types.TaskTaskResolveData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.taskTaskResolve({ ...options, client, throwOnError: true })),
    userInvitationCreate: (
      options: Omit<types.UserInvitationCreateData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.userInvitationCreate({ ...options, client, throwOnError: true })),
    userUserList: (options: Omit<types.UserUserListData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.userUserList({ ...options, client, throwOnError: true })),
    userUserCreate: (options: Omit<types.UserUserCreateData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.userUserCreate({ ...options, client, throwOnError: true })),
    userUserDelete: (options: Omit<types.UserUserDeleteData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.userUserDelete({ ...options, client, throwOnError: true })),
    userUserRead: (options: Omit<types.UserUserReadData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.userUserRead({ ...options, client, throwOnError: true })),
    userUserUpdate: (options: Omit<types.UserUserUpdateData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.userUserUpdate({ ...options, client, throwOnError: true })),
    userUserApproveRegistration: (
      options: Omit<types.UserUserApproveRegistrationData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) =>
        sdk.userUserApproveRegistration({ ...options, client, throwOnError: true }),
      ),
    userUserDeactivate: (
      options: Omit<types.UserUserDeactivateData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.userUserDeactivate({ ...options, client, throwOnError: true })),
    userUserHandle: (options: Omit<types.UserUserHandleData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.userUserHandle({ ...options, client, throwOnError: true })),
    userUserRoles: (options: Omit<types.UserUserRolesData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.userUserRoles({ ...options, client, throwOnError: true })),
    userUserSetPassword: (
      options: Omit<types.UserUserSetPasswordData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.userUserSetPassword({ ...options, client, throwOnError: true })),
    webhookDeliveryList: (
      options: Omit<types.WebhookDeliveryListData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.webhookDeliveryList({ ...options, client, throwOnError: true })),
    webhookDeliveryRead: (
      options: Omit<types.WebhookDeliveryReadData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.webhookDeliveryRead({ ...options, client, throwOnError: true })),
    webhookDeliveryReplay: (
      options: Omit<types.WebhookDeliveryReplayData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.webhookDeliveryReplay({ ...options, client, throwOnError: true })),
    webhookEndpointList: (
      options: Omit<types.WebhookEndpointListData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.webhookEndpointList({ ...options, client, throwOnError: true })),
    webhookEndpointCreate: (
      options: Omit<types.WebhookEndpointCreateData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.webhookEndpointCreate({ ...options, client, throwOnError: true })),
    webhookEndpointDelete: (
      options: Omit<types.WebhookEndpointDeleteData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.webhookEndpointDelete({ ...options, client, throwOnError: true })),
    webhookEndpointRead: (
      options: Omit<types.WebhookEndpointReadData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.webhookEndpointRead({ ...options, client, throwOnError: true })),
    webhookEndpointUpdate: (
      options: Omit<types.WebhookEndpointUpdateData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.webhookEndpointUpdate({ ...options, client, throwOnError: true })),
    webhookEndpointDisable: (
      options: Omit<types.WebhookEndpointDisableData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.webhookEndpointDisable({ ...options, client, throwOnError: true })),
    webhookEndpointEnable: (
      options: Omit<types.WebhookEndpointEnableData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.webhookEndpointEnable({ ...options, client, throwOnError: true })),
    webhookEndpointRotate: (
      options: Omit<types.WebhookEndpointRotateData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.webhookEndpointRotate({ ...options, client, throwOnError: true })),
    webhookEndpointTarget: (
      options: Omit<types.WebhookEndpointTargetData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.webhookEndpointTarget({ ...options, client, throwOnError: true })),
    scimGroupsList: (options: Omit<types.ScimGroupsListData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.scimGroupsList({ ...options, client, throwOnError: true })),
    scimGroupCreate: (options: Omit<types.ScimGroupCreateData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.scimGroupCreate({ ...options, client, throwOnError: true })),
    scimGroupDelete: (options: Omit<types.ScimGroupDeleteData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.scimGroupDelete({ ...options, client, throwOnError: true })),
    scimGroupGet: (options: Omit<types.ScimGroupGetData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.scimGroupGet({ ...options, client, throwOnError: true })),
    scimGroupPatch: (options: Omit<types.ScimGroupPatchData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.scimGroupPatch({ ...options, client, throwOnError: true })),
    scimGroupReplace: (
      options: Omit<types.ScimGroupReplaceData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.scimGroupReplace({ ...options, client, throwOnError: true })),
    scimResourceTypesList: (
      options: Omit<types.ScimResourceTypesListData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.scimResourceTypesList({ ...options, client, throwOnError: true })),
    scimResourceTypeGet: (
      options: Omit<types.ScimResourceTypeGetData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.scimResourceTypeGet({ ...options, client, throwOnError: true })),
    scimSchemasList: (options: Omit<types.ScimSchemasListData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.scimSchemasList({ ...options, client, throwOnError: true })),
    scimSchemaGet: (options: Omit<types.ScimSchemaGetData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.scimSchemaGet({ ...options, client, throwOnError: true })),
    scimServiceProviderConfig: (
      options: Omit<types.ScimServiceProviderConfigData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) => sdk.scimServiceProviderConfig({ ...options, client, throwOnError: true })),
    scimUsersList: (options: Omit<types.ScimUsersListData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.scimUsersList({ ...options, client, throwOnError: true })),
    scimUserCreate: (options: Omit<types.ScimUserCreateData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.scimUserCreate({ ...options, client, throwOnError: true })),
    scimUserDelete: (options: Omit<types.ScimUserDeleteData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.scimUserDelete({ ...options, client, throwOnError: true })),
    scimUserGet: (options: Omit<types.ScimUserGetData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.scimUserGet({ ...options, client, throwOnError: true })),
    scimUserPatch: (options: Omit<types.ScimUserPatchData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.scimUserPatch({ ...options, client, throwOnError: true })),
    scimUserReplace: (options: Omit<types.ScimUserReplaceData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.scimUserReplace({ ...options, client, throwOnError: true })),
  };
}
export type Operations = ReturnType<typeof bindOperations>;
