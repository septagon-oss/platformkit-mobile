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
    appResources: (options: Omit<types.AppResourcesData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.appResources({ ...options, client, throwOnError: true })),
    auditEventList: (options: Omit<types.AuditEventListData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.auditEventList({ ...options, client, throwOnError: true })),
    auditEventRead: (options: Omit<types.AuditEventReadData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.auditEventRead({ ...options, client, throwOnError: true })),
    authLogin: (options: Omit<types.AuthLoginData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authLogin({ ...options, client, throwOnError: true })),
    authLogout: (options: Omit<types.AuthLogoutData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authLogout({ ...options, client, throwOnError: true })),
    authMe: (options: Omit<types.AuthMeData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.authMe({ ...options, client, throwOnError: true })),
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
    contentContentUnpublish: (
      options: Omit<types.ContentContentUnpublishData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) => sdk.contentContentUnpublish({ ...options, client, throwOnError: true })),
    fileFileList: (options: Omit<types.FileFileListData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileList({ ...options, client, throwOnError: true })),
    fileFileUpload: (options: Omit<types.FileFileUploadData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileUpload({ ...options, client, throwOnError: true })),
    fileFileDelete: (options: Omit<types.FileFileDeleteData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileDelete({ ...options, client, throwOnError: true })),
    fileFileRead: (options: Omit<types.FileFileReadData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileRead({ ...options, client, throwOnError: true })),
    fileFileContent: (options: Omit<types.FileFileContentData, "url"> & { signal?: AbortSignal }) =>
      invoke((client) => sdk.fileFileContent({ ...options, client, throwOnError: true })),
    fileFileContentHead: (
      options: Omit<types.FileFileContentHeadData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.fileFileContentHead({ ...options, client, throwOnError: true })),
    notificationNotificationList: (
      options: Omit<types.NotificationNotificationListData, "url"> & { signal?: AbortSignal },
    ) =>
      invoke((client) =>
        sdk.notificationNotificationList({ ...options, client, throwOnError: true }),
      ),
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
    tenantTenantAddHost: (
      options: Omit<types.TenantTenantAddHostData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantAddHost({ ...options, client, throwOnError: true })),
    tenantTenantInvite: (
      options: Omit<types.TenantTenantInviteData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantInvite({ ...options, client, throwOnError: true })),
    tenantTenantSetLocale: (
      options: Omit<types.TenantTenantSetLocaleData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantSetLocale({ ...options, client, throwOnError: true })),
    tenantTenantSuspend: (
      options: Omit<types.TenantTenantSuspendData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.tenantTenantSuspend({ ...options, client, throwOnError: true })),
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
    siteSettingsRead: (
      options: Omit<types.SiteSettingsReadData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.siteSettingsRead({ ...options, client, throwOnError: true })),
    siteSettingsSave: (
      options: Omit<types.SiteSettingsSaveData, "url"> & { signal?: AbortSignal },
    ) => invoke((client) => sdk.siteSettingsSave({ ...options, client, throwOnError: true })),
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
  };
}
export type Operations = ReturnType<typeof bindOperations>;
