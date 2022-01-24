set -ex

OUTDIR="./certs"

openssl rand -writerand ~/.rnd
mkdir ${OUTDIR} || true
rm ${OUTDIR}/* || true

generate_keys() {
    DEVICE_ID=$1
    FILEBASE="${OUTDIR}/${DEVICE_ID}"
    openssl genpkey -out ${FILEBASE}.key -algorithm RSA -pkeyopt rsa_keygen_bits:2048
    openssl req -new -key ${FILEBASE}.key -out ${FILEBASE}.csr -subj /CN=${DEVICE_ID} -pubkey -keyout ${FILEBASE}.pub
    openssl x509 -req -days 365 -in ${FILEBASE}.csr -signkey ${FILEBASE}.key -out ${FILEBASE}.crt
    openssl x509 -in ${FILEBASE}.crt -noout -fingerprint | sed -e "s/^.*=//;s/://g" > ${FILEBASE}.fingerprint
}

create_identity() {
    DEVICE_ID=$1
    FILEBASE="${OUTDIR}/${DEVICE_ID}"
    THUMBPRINT=$(cat ${FILEBASE}.fingerprint)
    az iot hub device-identity delete -d ${DEVICE_ID} -n ${IOTHUB_TEST_HUB_NAME} || true
    az iot hub device-identity create -d ${DEVICE_ID} -n ${IOTHUB_TEST_HUB_NAME} --am x509_thumbprint --primary-thumbprint ${THUMBPRINT}
}

run_client() {
    DEVICE_ID=$1
    FILEBASE="${OUTDIR}/${DEVICE_ID}"
    export IOTHUB_TEST_DEVICE_ID=${DEVICE_ID}
    export IOTHUB_TEST_KEY_FILENAME=${FILEBASE}.key
    export IOTHUB_TEST_CERT_FILENAME=${FILEBASE}.crt
    node run.js
}

TRANSPORT=MQTT
EXPIRED=expired-${TRANSPORT}-${RANDOM}
NOT_YET_VALID=not-yet-valid-${TRANSPORT}-${RANDOM}

sudo timedatectl set-ntp no
sudo timedatectl set-time "2015-01-01"
generate_keys ${EXPIRED}
sudo timedatectl set-time "2025-01-01"
generate_keys ${NOT_YET_VALID}
sudo timedatectl set-ntp yes

create_identity ${EXPIRED}
create_identity ${NOT_YET_VALID}

run_client ${EXPIRED}
run_client ${EXPIRED}
run_client ${EXPIRED}
run_client ${NOT_YET_VALID}
run_client ${NOT_YET_VALID}
run_client ${NOT_YET_VALID}



# openssl ecparam -name prime256v1 -genkey -noout -out key.pem
