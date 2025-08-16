"use client";
import { atom } from "jotai";

export const orderIdAtom = atom<string | null>(null);
export const currentOrderIdAtom = atom<string | null>(null);
