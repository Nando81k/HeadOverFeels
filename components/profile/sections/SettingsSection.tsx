'use client'

import { RefObject } from 'react'
import {
  Camera,
  CircleNotch,
  User as UserIcon,
  Envelope,
  Phone,
  CalendarBlank,
  Bell,
  ChatCircle,
  SignOut,
  Gear,
  CaretRight,
  CheckCircle,
  XCircle,
} from '@phosphor-icons/react'
import { UserAvatar } from '@/components/ui/UserAvatar'

interface User {
  email: string
  name: string | null
  phone: string | null
  birthday: Date | null
  newsletter: boolean
  smsOptIn: boolean
  isAdmin: boolean
  createdAt: Date | string
  profilePictureUrl: string | null
}

interface SettingsSectionProps {
  user: User
  avatarInputRef: RefObject<HTMLInputElement | null>
  avatarUploading: boolean
  onSignout: () => void
}

interface FieldRowProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>
  label: string
  value: string | null | undefined
  comingSoon?: boolean
  onEdit?: () => void
}

function FieldRow({ icon: Icon, label, value, comingSoon, onEdit }: FieldRowProps) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center shrink-0">
        <Icon size={15} weight="bold" className="text-black/60" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-black/45 mb-0.5">
          {label}
        </p>
        <p className="text-sm text-black truncate">{value || <span className="text-black/35">Not set</span>}</p>
      </div>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-bold uppercase tracking-wider text-black/60 hover:text-black transition-colors flex items-center gap-1 shrink-0"
        >
          Edit
          <CaretRight size={11} weight="bold" />
        </button>
      ) : comingSoon ? (
        <span className="text-[10px] font-bold uppercase tracking-wider text-black/35 shrink-0">
          Soon
        </span>
      ) : null}
    </div>
  )
}

interface ToggleRowProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>
  label: string
  description: string
  enabled: boolean
}

function ToggleRow({ icon: Icon, label, description, enabled }: ToggleRowProps) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center shrink-0">
        <Icon size={15} weight="bold" className="text-black/60" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-black mb-0.5">{label}</p>
        <p className="text-xs text-black/50">{description}</p>
      </div>
      <span
        className={`inline-flex items-center gap-1 px-2.5 h-6 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
          enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-black/5 text-black/45'
        }`}
      >
        {enabled ? <CheckCircle size={11} weight="fill" /> : <XCircle size={11} weight="bold" />}
        {enabled ? 'On' : 'Off'}
      </span>
    </div>
  )
}

export function SettingsSection({
  user,
  avatarInputRef,
  avatarUploading,
  onSignout,
}: SettingsSectionProps) {
  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-8 md:space-y-10">

      {/* Profile info */}
      <section>
        <h2 className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-black/40 mb-3 md:mb-4">
          Profile information
        </h2>
        <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">

          {/* Avatar row */}
          <div className="flex items-center gap-4 p-4 md:p-5 border-b border-black/8">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative shrink-0 group"
              aria-label="Change profile picture"
              disabled={avatarUploading}
            >
              <UserAvatar
                src={user.profilePictureUrl}
                name={user.name}
                size={64}
                className="ring-2 ring-black/8"
              />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity">
                {avatarUploading ? (
                  <CircleNotch size={20} className="text-white animate-spin" />
                ) : (
                  <Camera size={20} className="text-white" weight="bold" />
                )}
              </span>
              {!avatarUploading && (
                <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-black flex items-center justify-center shadow-md ring-2 ring-white">
                  <Camera size={11} className="text-white" weight="bold" />
                </span>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-black/45 mb-0.5">
                Profile photo
              </p>
              <p className="text-sm font-bold text-black">{user.profilePictureUrl ? 'Photo set' : 'No photo yet'}</p>
              <p className="text-xs text-black/50 mt-0.5">Tap to upload or change</p>
            </div>
          </div>

          <div className="px-4 md:px-5 divide-y divide-black/5">
            <FieldRow icon={UserIcon} label="Name" value={user.name} comingSoon />
            <FieldRow icon={Envelope} label="Email" value={user.email} comingSoon />
            <FieldRow icon={Phone} label="Phone" value={user.phone} comingSoon />
            <FieldRow
              icon={CalendarBlank}
              label="Birthday"
              value={
                user.birthday
                  ? new Date(user.birthday).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                    })
                  : null
              }
              comingSoon
            />
          </div>
        </div>
      </section>

      {/* Communication preferences */}
      <section>
        <h2 className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-black/40 mb-3 md:mb-4">
          Communication preferences
        </h2>
        <div className="rounded-2xl border border-black/10 bg-white px-4 md:px-5 divide-y divide-black/5">
          <ToggleRow
            icon={Bell}
            label="Newsletter"
            description="Drops, sales, and updates by email"
            enabled={user.newsletter}
          />
          <ToggleRow
            icon={ChatCircle}
            label="SMS messages"
            description="Order updates and exclusive deals by text"
            enabled={user.smsOptIn}
          />
        </div>
      </section>

      {/* Account */}
      <section>
        <h2 className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-black/40 mb-3 md:mb-4">
          Account
        </h2>
        <div className="rounded-2xl border border-black/10 bg-white px-4 md:px-5 divide-y divide-black/5">
          <FieldRow icon={CalendarBlank} label="Member since" value={memberSince} />
          {user.isAdmin && <FieldRow icon={Gear} label="Admin access" value="Enabled" />}

          {/* Sign out */}
          <div className="py-4">
            <button
              type="button"
              onClick={onSignout}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-full border border-black/15 text-xs font-bold uppercase tracking-wider text-black hover:bg-black hover:text-white hover:border-black transition-colors"
            >
              <SignOut size={13} weight="bold" />
              Sign out
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
