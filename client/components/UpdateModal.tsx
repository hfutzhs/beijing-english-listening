import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface UpdateModalProps {
  visible: boolean;
  status: 'available' | 'downloading' | 'ready' | 'error';
  message: string;
  onUpdate: () => void;
  onLater: () => void;
}

export function UpdateModal({ visible, status, message, onUpdate, onLater }: UpdateModalProps) {
  const isDownloading = status === 'downloading';
  const isReady = status === 'ready';
  const isError = status === 'error';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-sm rounded-3xl bg-white p-6">
          {/* Icon */}
          <View className="mb-4 items-center">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              {isDownloading || isReady ? (
                <ActivityIndicator size="large" color="#B45309" />
              ) : (
                <MaterialIcons name="system-update" size={32} color="#B45309" />
              )}
            </View>
          </View>

          {/* Title */}
          <Text className="mb-2 text-center text-lg font-bold text-gray-900">
            {isReady ? '更新就绪' : isDownloading ? '正在更新' : isError ? '更新失败' : '发现新版本'}
          </Text>

          {/* Message */}
          <Text className="mb-6 text-center text-sm text-gray-500">
            {message || (status === 'available' ? '检测到新版本，建议立即更新以获取最新功能和优化。' : '')}
          </Text>

          {/* Buttons */}
          <View className="flex-row gap-3">
            {!isDownloading && !isReady && (
              <TouchableOpacity
                className="flex-1 rounded-xl bg-gray-100 py-3.5"
                onPress={onLater}
                activeOpacity={0.7}
              >
                <Text className="text-center text-sm font-semibold text-gray-600">稍后</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className={`flex-1 rounded-xl py-3.5 ${isError ? 'bg-amber-600' : 'bg-amber-600'}`}
              onPress={onUpdate}
              disabled={isDownloading || isReady}
              activeOpacity={0.7}
            >
              <Text className="text-center text-sm font-semibold text-white">
                {isDownloading ? '下载中...' : isReady ? '重启应用' : isError ? '重试' : '立即更新'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
