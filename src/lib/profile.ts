export type Profile = {
  fullName?: string;
  email?: string;
  phone?: string;
};

const defaults: Required<Profile> = {
  fullName: "Admin User",
  email: "vansluysyongen@gmail.com",
  phone: "62 821-9574-2400",
};

export function getProfile(): Required<Profile> {
  try {
    const raw = localStorage.getItem("invgenz:profile") || "{}";
    const p = JSON.parse(raw) as Profile;
    return { ...defaults, ...p };
  } catch {
    return defaults;
  }
}

export function saveProfile(patch: Profile) {
  try {
    const curr = getProfile();
    const next = { ...curr, ...patch } as Required<Profile>;
    localStorage.setItem("invgenz:profile", JSON.stringify(next));
    return next;
  } catch {
    // noop
    return getProfile();
  }
}