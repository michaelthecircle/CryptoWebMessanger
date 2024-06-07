package ru.borovitin.cryptochat.user;


import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository repository;

    public void saveUser(User user) {
        var existingUser = repository.findByNickName(user.getNickName());
        if (existingUser != null) {
            // Update existing user status to ONLINE
            existingUser.setStatus(Status.ONLINE);
            repository.save(existingUser);
        } else {
            // Save new user
            user.setStatus(Status.ONLINE);
            repository.save(user);
        }
    }

    public void disconnect(User user) {
        var storedUser = repository.findById(user.getNickName()).orElse(null);
        if (storedUser != null) {
            storedUser.setStatus(Status.OFFLINE);
            repository.save(storedUser);
        }
    }

    public List<User> findConnectedUsers() {
        return repository.findAllByStatus(Status.ONLINE);
    }
}
