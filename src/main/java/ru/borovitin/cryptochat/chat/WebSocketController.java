package ru.borovitin.cryptochat.chat;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;
import ru.borovitin.cryptochat.user.User;

import java.security.Principal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Controller
public class WebSocketController {

    private final Map<String, Integer> userPrivateKeys = new ConcurrentHashMap<>();
    private final Map<String, Integer> userPublicKeys = new ConcurrentHashMap<>();

    public class PublicKeyRequest {
        private int publicKey;

        // Getters and Setters
        public int getPublicKey() {
            return publicKey;
        }

        public void setPublicKey(int publicKey) {
            this.publicKey = publicKey;
        }
    }

    public class PublicKeyResponse {
        private int publicKey;

        public PublicKeyResponse(int publicKey) {
            this.publicKey = publicKey;
        }

        // Getters and Setters
        public int getPublicKey() {
            return publicKey;
        }

        public void setPublicKey(int publicKey) {
            this.publicKey = publicKey;
        }
    }

    private final Map<String, Integer> userSharedSecrets = new ConcurrentHashMap<>();


    @MessageMapping("/user.sendPublicKey")
    @SendToUser("/queue/publicKey")
    public PublicKeyResponse sendPublicKey(PublicKeyRequest request, Principal principal) {
        String username = principal.getName();
        int privateKey = (int) (Math.random() * 100) + 1;
        int publicKey = (int) (Math.pow(5, privateKey) % 23);

        userPrivateKeys.put(username, privateKey);
        userPublicKeys.put(username, publicKey);

        int receivedPublicKey = request.getPublicKey();
        int sharedSecret = (int) (Math.pow(receivedPublicKey, privateKey) % 23);
        userSharedSecrets.put(username, sharedSecret);

        return new PublicKeyResponse(publicKey);
    }

    @MessageMapping("/user.getPublicKey")
    @SendToUser("/queue/publicKey")
    public PublicKeyResponse getPublicKey(Principal principal) {
        String username = principal.getName();
        int publicKey = userPublicKeys.get(username);
        return new PublicKeyResponse(publicKey);
    }
}

