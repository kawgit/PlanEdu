from random import shuffle

with open("class_urls_cas.txt") as file:
    lines = file.readlines()
    
shuffle(lines)

print("".join(lines[:50]))