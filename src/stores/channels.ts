import { create } from "zustand";
import type { ChannelInfo } from "@/protocol/types";

interface ChannelsState {
  channels: ChannelInfo[];

  setChannels: (channels: ChannelInfo[]) => void;
  handleChannelEvent: (payload: unknown) => void;
  clear: () => void;
}

export const useChannelsStore = create<ChannelsState>((set) => ({
  channels: [],

  setChannels: (channels: ChannelInfo[]) => {
    set({ channels });
  },

  handleChannelEvent: (payload: unknown) => {
    const data = payload as Record<string, unknown>;
    const event = data.event as string;
    const channel = data.channel as ChannelInfo | undefined;

    if (event === "updated" && channel) {
      set((state) => ({
        channels: state.channels.map((c) =>
          c.id === channel.id ? channel : c,
        ),
      }));
    } else if (event === "added" && channel) {
      set((state) => ({
        channels: [...state.channels, channel],
      }));
    } else if (event === "removed") {
      const channelId = data.channelId as string;
      set((state) => ({
        channels: state.channels.filter((c) => c.id !== channelId),
      }));
    }
  },

  clear: () => {
    set({ channels: [] });
  },
}));
